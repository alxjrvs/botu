# botu

A small, installable **dotfiles + workspace engine** — `apply`/`verify`/`fix`
your machine from a declarative `botufile`, and open portals to your code
workspaces. Just `bash` + `git`.

Named for Jack Kirby's **Boom Tube** (the Fourth World portal).

> Status: **early** — extracted from [`alxjrvs/dotFiles`](https://github.com/alxjrvs/dotFiles).
> See [`SPEC.md`](SPEC.md) for the design and build plan.

## Quickstart

```sh
botu init ~/dotfiles     # record your dotfiles repo (+ writes botuinit.sh there)
botu apply               # symlink/copy/install/run from its botufile
botu verify              # check for drift (exit 0 ok / 2 warn / 1 fail)
botu fix                 # repair drift

botu code init ~/Code    # record your code dir
botu code claude         # one idle `claude --bg` agent per repo
botu code cmux           # one cmux workspace per repo
```

## The `botufile`

Your dotfiles repo's config is a short bash program of verb-aware declarations:

```bash
section "Shell"
link .zshrc ~/.zshrc
link --mode 600 ssh/config ~/.ssh/config
glob 'zsh/[0-9]*.zsh' ~/.config/zsh/

brewfile Brewfile
osx_default com.apple.dock autohide bool true

hook op-agent vault=claude-agent     # imperative escape hatch → hooks/op-agent.sh
```

`botu apply|verify|fix` source it once under the matching verb. No JSON, no
templating language — the config *is* the program.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/alxjrvs/botu/main/install.sh | sh
```

(installer is part of the build — see SPEC.)
