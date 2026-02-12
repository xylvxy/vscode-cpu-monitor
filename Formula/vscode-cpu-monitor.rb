class VscodeCpuMonitor < Formula
  desc "Monitor and kill VS Code zombie processes with high CPU usage"
  homepage "https://github.com/xylvxy/vscode-cpu-monitor"
  url "https://registry.npmjs.org/@shawn777/vscode-cpu-monitor/-/vscode-cpu-monitor-1.1.1.tgz"
  sha256 "0f65d4de842269a5224bd89a07bf575df128fefd0992bff4a1d29972937bc5ce"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "Code Monitor Started", shell_output("#{bin}/vscode-cpu-monitor 2>&1 &; sleep 2; kill $!")
  end
end
