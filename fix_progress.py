import sys
with open('src/pages/ColorLineGame.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_start = "      setScore((s) => s + 1)"
old_end = "        localStorage.setItem('color_game_today', String(newVal))"
start_idx = content.find(old_start)
end_idx = content.find(old_end, start_idx)
if start_idx == -1 or end_idx == -1:
    print("NOT FOUND")
    sys.exit(1)
end_idx += len(old_end)

old = content[start_idx:end_idx]
print("Found block:")
print(repr(old))

new = "      setScore((s) => s + 1)\n      setShowReward(true)\n      // 每凑对一组进度+1\n      const newVal = todayCompleted + 1\n      setTodayCompleted(newVal)\n      localStorage.setItem('color_game_today', String(newVal))"
content = content[:start_idx] + new + content[end_idx:]

with open('src/pages/ColorLineGame.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("OK - replaced")
