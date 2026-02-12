class VscodeCpuMonitor < Formula
  desc "Monitor and kill VS Code zombie processes with high CPU usage"
  homepage "https://github.com/xylvxy/vscode-cpu-monitor"
  url "https://registry.npmjs.org/@shawn777/vscode-cpu-monitor/-/vscode-cpu-monitor-1.1.0.tgz"
  sha256 "b753cfc84b4b91d1afd862a12244009a68f4a73df8b75d40bb2c787c72861ac4"
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
