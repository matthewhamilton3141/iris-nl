# demo.tape — records a GIF of iris-nl in action.
#
# Install VHS:  brew install vhs       (https://github.com/charmbracelet/vhs)
# Record:       vhs demo.tape          (run from the repo root; needs `npm install` first)
# Output:       demo.gif
#
# Uses the offline `mock` provider so the recording is deterministic and needs no
# API key or network. The real providers (nvidia / ollama / tensorrt) behave identically.

Output demo.gif

Require node

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 720
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms

# --- hidden setup: make `iris-nl` a clean, pretty-printed command (mock provider) ---
Hide
Type 'iris-nl() { IRIS_NL_PROVIDER=mock node --import tsx src/cli.ts "$@" | python3 -m json.tool; }'
Enter
Type "clear"
Enter
Show

# --- the demo ---
Sleep 600ms
Type "iris-nl 'undo my last commit but keep my changes'"
Sleep 500ms
Enter
Sleep 2.5s

Type "iris-nl 'what is using port 3000'"
Sleep 500ms
Enter
Sleep 2.5s

# this one returns danger:true — shows the safety flag in action
Type "iris-nl 'delete all node_modules folders here'"
Sleep 500ms
Enter
Sleep 3s

Sleep 1.2s
