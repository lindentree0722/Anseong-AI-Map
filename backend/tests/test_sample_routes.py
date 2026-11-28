from statistics import mean

import sample_routes


def test_route_search_reuses_turn_wait_averages(monkeypatch):
    network, traffic, signals = sample_routes.load_route_data()
    samples = []

    def track_mean(values):
        samples.append(values)
        return mean(values)

    monkeypatch.setattr(sample_routes, "mean", track_mean)
    routes = sample_routes.compare_paths(network, traffic, signals, "grid-node-1", "node-03", 8)

    assert routes == []
    assert len(samples) == len({id(values) for values in samples})
