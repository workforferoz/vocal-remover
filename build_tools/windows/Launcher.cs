using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;

namespace VocalRemover
{
    static class Launcher
    {
        [STAThread]
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string configFile = Path.Combine(appDir, "config.txt");
            
            // Default URL - can be set to Vercel URL
            string appUrl = "http://localhost:5173";
            if (File.Exists(configFile))
            {
                try
                {
                    string content = File.ReadAllText(configFile).Trim();
                    if (!string.IsNullOrEmpty(content) && content.StartsWith("http"))
                    {
                        appUrl = content;
                    }
                }
                catch { }
            }

            // Find Microsoft Edge or Google Chrome to run in standalone app window
            string edgePath1 = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            string edgePath2 = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
            string chromePath1 = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            string chromePath2 = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";
            string chromePath3 = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe");

            string browserPath = null;
            if (File.Exists(edgePath1)) browserPath = edgePath1;
            else if (File.Exists(edgePath2)) browserPath = edgePath2;
            else if (File.Exists(chromePath1)) browserPath = chromePath1;
            else if (File.Exists(chromePath2)) browserPath = chromePath2;
            else if (File.Exists(chromePath3)) browserPath = chromePath3;

            try
            {
                if (browserPath != null)
                {
                    // Launch in standalone app mode (borderless, no URL bar, no browser tabs)
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browserPath;
                    psi.Arguments = string.Format("--app=\"{0}\" --window-size=1150,820", appUrl);
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                }
                else
                {
                    // Fallback to default browser
                    Process.Start(appUrl);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not open Vocal Remover:\n" + ex.Message, "Vocal Remover", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
