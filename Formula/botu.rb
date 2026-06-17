# Homebrew formula for botu. Lives here so the repo doubles as its own tap:
#   brew tap alxjrvs/botu https://github.com/alxjrvs/botu
#   brew install botu               # from a tagged release (needs url+sha256)
#   brew install --HEAD botu        # straight from main, no checksum needed
#
# On a new release: bump `url` to the tag tarball and fill `sha256` with
#   curl -fsSL https://github.com/alxjrvs/botu/archive/refs/tags/vX.Y.Z.tar.gz | shasum -a 256
class Botu < Formula
  desc "Installable dotfiles + workspace engine — just bash and git"
  homepage "https://github.com/alxjrvs/botu"
  url "https://github.com/alxjrvs/botu/archive/refs/tags/v0.0.1.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"
  head "https://github.com/alxjrvs/botu.git", branch: "main"

  def install
    # Ship the engine intact under libexec; VERSION sits one level above engine/
    # exactly where the launcher looks for it ($ENGINE_DIR/../VERSION).
    libexec.install "engine"
    libexec.install "VERSION"

    # A tiny stub execs the real entrypoint. The launcher resolves its own path,
    # so every engine/ sibling is found regardless of where the stub lives.
    (bin/"botu").write <<~SH
      #!/bin/sh
      exec "#{libexec}/engine/botu" "$@"
    SH
  end

  test do
    assert_match "botu", shell_output("#{bin}/botu --version")
    assert_match "usage: botu", shell_output("#{bin}/botu --help")
  end
end
