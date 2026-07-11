# Homebrew formula — installs the prebuilt boom binary (a single self-contained
# executable compiled from TypeScript via Bun). The repo doubles as its own tap:
#   brew tap alxjrvs/boom https://github.com/alxjrvs/boom
#   brew install boom
# sha256 values are filled in by the release workflow when a tag is cut.
class Boom < Formula
  desc "Installable dotfiles + workspace engine — apply/verify/fix from boomfile.toml"
  homepage "https://github.com/alxjrvs/boom"
  version "0.7.0"

  on_macos do
    on_arm do
      url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-darwin-arm64"
      sha256 "4379755c970014723cdc5d41d80f089ca603fd5daf942fb97addb9dc4ecdb2a3"
    end
    on_intel do
      url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-darwin-x64"
      sha256 "f4cec40b011c354caa77de9cd75d0bf63109515812b73840b95a0c05c0387614"
    end
  end

  on_linux do
    url "https://github.com/alxjrvs/boom/releases/download/v#{version}/boom-bun-linux-x64"
    sha256 "0d660c7a24f35833bd50c907d72be24e1cdd3a643a0a623632d0adaaba560075"
  end

  def install
    bin.install Dir["boom-*"].first => "boom"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/boom --version")
  end
end
