# Homebrew formula — installs the prebuilt boom binary (a single self-contained
# executable compiled from TypeScript via Bun). The repo doubles as its own tap:
#   brew tap alxjrvs/boom https://github.com/alxjrvs/boom
#   brew install boom
# sha256 values are filled in by the release workflow when a tag is cut.
class Boom < Formula
  desc "Declarative dev-machine setup — sync/verify dotfiles, packages, and tools from boomfile.toml"
  homepage "https://github.com/alxjrvs/boom"
  version "0.16.0"

  on_macos do
    on_arm do
      url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-darwin-arm64"
      sha256 "a6e7d447541a41638f8c3389eb04b2d61367183119c68f4a1b1bd500a554a140"
    end
    on_intel do
      url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-darwin-x64"
      sha256 "9f9667732b8ff3c65bc47e05713d2b900aaf41793f5182c4b285b82fbbcd125a"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-linux-arm64"
      sha256 "35e4c9ba75d8c829e15333204e0c0fc52272fc6b99e1fb573524ba9ce79f41ff"
    end
    on_intel do
      url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-linux-x64"
      sha256 "aac3bcad03cb9c7032e7dda534cfdfbbbeef7959e239675690e75b4699a8344b"
    end
  end

  def install
    bin.install Dir["boom-*"].first => "boom"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/boom --version")
  end
end
