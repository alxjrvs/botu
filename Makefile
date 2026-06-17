# botu — dev tasks. Just bash + git; these wrap the three checks CI also runs.
# Generated files (examples/dotfiles/botuinit.sh — written by `botu init`) are
# deliberately excluded: their source is the heredoc in engine/botu.
SHELL_FILES := engine/botu engine/run engine/lib.sh \
	$(wildcard engine/commands/*) \
	install.sh \
	$(wildcard examples/dotfiles/hooks/*.sh)

.PHONY: all check lint fmt fmt-check test

all: check

check: lint fmt-check test ## run every check (CI parity)

lint: ## shellcheck every shell file
	shellcheck -x $(SHELL_FILES)

fmt: ## rewrite shell files to canonical format
	shfmt -i 2 -ci -sr -w $(SHELL_FILES)

fmt-check: ## fail if any shell file is not canonically formatted
	shfmt -i 2 -ci -sr -d $(SHELL_FILES)

test: ## run the bats suite
	bats test/
