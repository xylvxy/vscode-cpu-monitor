class VscodeCpuMonitor < Formula
  desc "Monitor and kill VS Code zombie processes with high CPU usage"
  homepage "https://github.com/xylvxy/vscode-cpu-monitor"
  url "https://registry.npmjs.org/@shawn777/vscode-cpu-monitor/-/vscode-cpu-monitor-1.0.1.tgz"
  sha256 "c8d3eae160a892e32837db3dcae515e843e5383fef52b8141940c8bcf8b6d59f"
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
