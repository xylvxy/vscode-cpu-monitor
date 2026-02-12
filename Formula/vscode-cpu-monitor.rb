class VscodeCpuMonitor < Formula
  desc "Monitor and kill VS Code zombie processes with high CPU usage"
  homepage "https://github.com/xylvxy/vscode-cpu-monitor"
  url "https://registry.npmjs.org/@shawn777/vscode-cpu-monitor/-/vscode-cpu-monitor-1.0.2.tgz"
  sha256 "bc061bd5ef3adedfe68a1b3c552667b87e29d63de3e693ef96ca2135b2bd7ec9"
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
