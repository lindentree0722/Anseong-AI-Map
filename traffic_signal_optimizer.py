#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
traffic_signal_cli.py
신호등 최적화( Webser 방법 ) - 입력: JSON/CSV/대화형, 출력: 보기좋은 표 및 CSV 저장 가능
사용: python traffic_signal_cli.py --help
"""

import argparse
import json
import csv
import sys
import os
from typing import Dict, Any, List

# ---------- 핵심 계산 함수 (Webster) ----------
def compute_webster(signal_info: Dict[str, Any],
                    s_per_lane: float = 1800.0,
                    lost_per_phase: float = 4.0,
                    min_green: float = 6.0,
                    max_cycle: float = 180.0) -> Dict[str, Any]:
    phases = signal_info.get("phases", [])
    # 오버라이드 가능한 입력 파라미터
    if "lost_per_phase" in signal_info:
        lost_per_phase = float(signal_info["lost_per_phase"])
    if "min_green" in signal_info:
        min_green = float(signal_info["min_green"])
    if "s_per_lane" in signal_info:
        s_per_lane = float(signal_info["s_per_lane"])

    n = len(phases)
    if n == 0:
        return {"error": "위상 정보가 없습니다."}

    # 기본값 채우기 및 흐름비 계산
    for p in phases:
        p.setdefault("lanes", 1)
        p.setdefault("s_per_lane", s_per_lane)
        p["s_i"] = p["lanes"] * p["s_per_lane"]
        try:
            p["q_i"] = float(p.get("flow", 0.0))
        except (ValueError, TypeError):
            p["q_i"] = 0.0
        p["y_i"] = p["q_i"] / p["s_i"] if p["s_i"] > 0 else 0.0

    Y = sum(p["y_i"] for p in phases)
    L = n * lost_per_phase

    if Y >= 1.0:
        return {"error": "총 흐름비 Y >= 1.0 입니다. (포화 상태). 신호 구조 재검토가 필요합니다.", "Y": Y}

    C0 = (1.5 * L + 5.0) / (1.0 - Y)
    C = max(20.0, min(C0, max_cycle))

    def allocate(C_val):
        effective_green_total = C_val - L
        alloc = []
        for p in phases:
            share = (p["y_i"] / Y) if Y > 0 else (1.0 / n)
            g = share * effective_green_total
            alloc.append(g)
        return alloc

    greens = allocate(C)
    adjusted = [max(g, min_green) for g in greens]
    sum_adjusted = sum(adjusted)
    if sum_adjusted + L > C:
        C = sum_adjusted + L
        if C > max_cycle:
            return {"error": "최소 녹색 제약을 만족시키려면 주기가 max_cycle 보다 큽니다.",
                    "required_C": C, "max_cycle": max_cycle}
        greens = allocate(C)
        adjusted = [max(g, min_green) for g in greens]

    out_phases = []
    for i, p in enumerate(phases):
        g = adjusted[i]
        out_phases.append({
            "id": p.get("id", str(i)),
            "flow": p["q_i"],
            "lanes": p["lanes"],
            "s_i": p["s_i"],
            "y": p["y_i"],
            "g": g,
        })

    return {
        "C": C,
        "L": L,
        "Y": Y,
        "phases": out_phases
    }

# ---------- 출력 유틸 ----------
def pretty_print_result(result: Dict[str, Any]):
    if "error" in result:
        print("ERROR:", result["error"])
        for k in ("Y", "required_C", "max_cycle"):
            if k in result:
                print(f"{k}: {result[k]}")
        return

    C = result["C"]
    L = result["L"]
    Y = result["Y"]
    phases = result["phases"]

    print("="*80)
    print("신호 최적화 결과 (Webster 방법)")
    print("-"*80)
    print(f"최적 주기 (C)        : {C:.2f} s")
    print(f"총 손실시간 (L)      : {L:.2f} s")
    print(f"총 흐름비 (Y)        : {Y:.4f}")
    print("="*80)

    headers = ["위상(Phase)", "유량(flow veh/h)", "차로수", "포화유량(s_i)", "흐름비(y)", "녹색시간(g) s", "점유비(%)"]
    col_widths = [18, 16, 8, 14, 12, 14, 12]

    header_line = ""
    for h, w in zip(headers, col_widths):
        header_line += h.ljust(w)
    print(header_line)
    print("-"*sum(col_widths))

    for p in phases:
        share_pct = (p["y"] / Y * 100) if Y > 0 else 0.0
        row = f"{str(p['id']):18}" \
              f"{p['flow']:16.0f}" \
              f"{p['lanes']:8d}" \
              f"{p['s_i']:14.0f}" \
              f"{p['y']:12.4f}" \
              f"{p['g']:14.2f}" \
              f"{share_pct:12.2f}"
        print(row)
    print("-"*sum(col_widths))

    max_flow_phase = max(phases, key=lambda x: x["flow"])
    max_green_phase = max(phases, key=lambda x: x["g"])
    print(f"총 위상 수: {len(phases)}    가장 유량이 큰 위상: {max_flow_phase['id']} ({max_flow_phase['flow']} veh/h)")
    print(f"가장 긴 녹색시간 위상: {max_green_phase['id']} ({max_green_phase['g']:.2f} s)")
    print("="*80)

def save_csv(result: Dict[str, Any], filename: str):
    if "error" in result:
        raise ValueError("결과에 에러가 있어 CSV 저장 불가: " + result["error"])
    phases = result["phases"]
    with open(filename, "w", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["phase_id", "flow", "lanes", "s_i", "y", "g"])
        for p in phases:
            writer.writerow([p["id"], f"{p['flow']:.0f}", p["lanes"], f"{p['s_i']:.0f}", f"{p['y']:.6f}", f"{p['g']:.3f}"])

# ---------- 입력 파서 ----------
def read_json_file(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"파일을 찾을 수 없음: {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "phases" not in data:
        raise ValueError("JSON 파일에 'phases' 키가 필요합니다.")
    return data

def read_csv_file(path: str, s_per_lane: float = 1800.0) -> Dict[str, Any]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"파일을 찾을 수 없음: {path}")
    phases = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            pid = row.get("phase_id") or row.get("id") or row.get("phase") or row.get("phaseId")
            flow = row.get("flow") or row.get("q") or row.get("volume")
            lanes = row.get("lanes") or row.get("lane") or 1
            try:
                flow_v = float(flow) if flow is not None and flow != "" else 0.0
            except (ValueError, TypeError):
                flow_v = 0.0
            try:
                lanes_v = int(float(lanes)) if lanes not in (None, "") else 1
            except (ValueError, TypeError):
                lanes_v = 1
            phases.append({"id": pid or f"phase_{len(phases)+1}", "flow": flow_v, "lanes": lanes_v, "s_per_lane": s_per_lane})
    return {"phases": phases}

def interactive_input() -> Dict[str, Any]:
    print("대화형 입력을 시작합니다. 위상 수를 입력하세요.")
    while True:
        try:
            n = int(input("위상 수 (예: 4): ").strip())
            if n <= 0:
                print("양수를 입력하세요.")
                continue
            break
        except Exception:
            print("정수를 입력하세요.")
    phases = []
    for i in range(n):
        print(f"\n--- 위상 {i+1} ---")
        pid = input(f"위상 ID (기본: P{i+1}): ").strip() or f"P{i+1}"
        while True:
            try:
                flow = float(input("유량 (veh/h): ").strip())
                if flow < 0:
                    print("0 이상의 숫자를 입력하세요.")
                    continue
                break
            except Exception:
                print("숫자를 입력하세요.")
        while True:
            try:
                lanes = input("차로수 (기본 1): ").strip()
                if lanes == "":
                    lanes_v = 1
                else:
                    lanes_v = int(float(lanes))
                    if lanes_v <= 0:
                        print("1 이상의 정수를 입력하세요.")
                        continue
                break
            except Exception:
                print("정수를 입력하세요.")
        phases.append({"id": pid, "flow": flow, "lanes": lanes_v})
    # 추가 파라미터 선택 입력
    def ask_float(prompt, default):
        v = input(f"{prompt} (기본 {default}): ").strip()
        if v == "":
            return default
        try:
            return float(v)
        except Exception:
            print("잘못된 입력입니다. 기본값 사용:", default)
            return default

    lost_per_phase = ask_float("위상당 손실시간 lost_per_phase (초)", 4.0)
    min_green = ask_float("최소 녹색 min_green (초)", 6.0)
    s_per_lane = ask_float("차로당 포화유량 s_per_lane (veh/h)", 1800.0)

    return {"phases": phases, "lost_per_phase": lost_per_phase, "min_green": min_green, "s_per_lane": s_per_lane}

# ---------- 메인 ----------
def main():
    parser = argparse.ArgumentParser(description="신호 최적화 (Webster) - JSON/CSV/Interactive 입력 지원")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--json", "-j", help="입력 JSON 파일 경로")
    group.add_argument("--csv", "-c", help="입력 CSV 파일 경로")
    group.add_argument("--interactive", "-i", action="store_true", help="대화형 입력")
    parser.add_argument("--s-per-lane", type=float, default=1800.0, help="차로당 포화유량 (veh/h) 기본 1800")
    parser.add_argument("--lost-per-phase", type=float, default=4.0, help="위상당 손실시간 (초) 기본 4")
    parser.add_argument("--min-green", type=float, default=6.0, help="최소 녹색시간 (초) 기본 6")
    parser.add_argument("--max-cycle", type=float, default=180.0, help="최대 허용 주기 (초)")
    parser.add_argument("--save-csv", help="결과를 저장할 CSV 파일 경로 (선택)")
    args = parser.parse_args()

    try:
        if args.json:
            signal_info = read_json_file(args.json)
        elif args.csv:
            signal_info = read_csv_file(args.csv, s_per_lane=args.s_per_lane)
        else:
            # 대화형(명시적 --interactive 또는 기본)
            signal_info = interactive_input()

        # 커맨드라인 옵션으로 재정의(우선권)
        signal_info.setdefault("s_per_lane", args.s_per_lane)
        signal_info.setdefault("lost_per_phase", args.lost_per_phase)
        signal_info.setdefault("min_green", args.min_green)

        result = compute_webster(signal_info,
                                 s_per_lane=float(signal_info.get("s_per_lane", args.s_per_lane)),
                                 lost_per_phase=float(signal_info.get("lost_per_phase", args.lost_per_phase)),
                                 min_green=float(signal_info.get("min_green", args.min_green)),
                                 max_cycle=args.max_cycle)

        pretty_print_result(result)

        if args.save_csv:
            try:
                save_csv(result, args.save_csv)
                print(f"결과를 CSV로 저장했습니다: {args.save_csv}")
            except Exception as e:
                print("CSV 저장 실패:", str(e))

    except Exception as e:
        print("에러 발생:", str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()