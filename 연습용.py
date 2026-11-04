numbers = ['10','11', '12','13', '14','15']
total = 0

for n in numbers:
    if int(n) % 5 == 0:
        total += int(n)
    else:
        if int(n) != 11 and int(n) != 14:
            total += int(n)
print(total)