using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using System.Reflection;
using System.IO.Compression;
using Microsoft.Win32;

namespace VocalRemoverInstaller
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Handle uninstall flag
            if (args.Length > 0 && args[0].ToLower() == "/uninstall")
            {
                Uninstall();
                return;
            }

            Application.Run(new InstallerForm());
        }

        static void Uninstall()
        {
            DialogResult res = MessageBox.Show(
                "Are you sure you want to uninstall Vocal Remover from your computer?",
                "Vocal Remover Uninstall",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );

            if (res != DialogResult.Yes) return;

            try
            {
                string installDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    @"Programs\VocalRemover"
                );

                string desktopLnk = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    "Vocal Remover.lnk"
                );

                string startMenuDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                    @"Programs"
                );
                string startLnk = Path.Combine(startMenuDir, "Vocal Remover.lnk");

                if (File.Exists(desktopLnk)) File.Delete(desktopLnk);
                if (File.Exists(startLnk)) File.Delete(startLnk);

                // Remove registry key
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\VocalRemover", false);

                // Schedule directory cleanup on exit
                if (Directory.Exists(installDir))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "cmd.exe";
                    psi.Arguments = string.Format("/c timeout /t 2 /nobreak & rmdir /s /q \"{0}\"", installDir);
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.CreateNoWindow = true;
                    Process.Start(psi);
                }

                MessageBox.Show(
                    "Vocal Remover has been uninstalled successfully.",
                    "Vocal Remover",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Uninstall error: " + ex.Message,
                    "Vocal Remover",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }

    public class InstallerForm : Form
    {
        private TextBox txtUrl;
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;
        private Button btnInstall;
        private Label lblStatus;

        public InstallerForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Vocal Remover Setup";
            this.Size = new Size(520, 430);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(13, 21, 39); // #0D1527
            this.ForeColor = Color.FromArgb(248, 250, 252); // #F8FAFC
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            // Title Banner
            Panel topPanel = new Panel();
            topPanel.Dock = DockStyle.Top;
            topPanel.Height = 85;
            topPanel.BackColor = Color.FromArgb(8, 13, 24); // #080D18
            this.Controls.Add(topPanel);

            Label lblTitle = new Label();
            lblTitle.Text = "Vocal Remover - Desktop Setup";
            lblTitle.Font = new Font("Segoe UI", 13F, FontStyle.Bold);
            lblTitle.ForeColor = Color.White;
            lblTitle.Location = new Point(24, 18);
            lblTitle.AutoSize = true;
            topPanel.Controls.Add(lblTitle);

            Label lblSubtitle = new Label();
            lblSubtitle.Text = "Extract instrumentals & remove vocals - Ayesha Tech Studio";
            lblSubtitle.Font = new Font("Segoe UI", 9F, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(148, 163, 184); // #94A3B8
            lblSubtitle.Location = new Point(24, 46);
            lblSubtitle.AutoSize = true;
            topPanel.Controls.Add(lblSubtitle);

            // Main Content Area
            Panel mainPanel = new Panel();
            mainPanel.Location = new Point(24, 105);
            mainPanel.Size = new Size(456, 215);
            this.Controls.Add(mainPanel);

            Label lblUrlTitle = new Label();
            lblUrlTitle.Text = "Application Engine URL (Local or Hosted):";
            lblUrlTitle.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            lblUrlTitle.Location = new Point(0, 5);
            lblUrlTitle.AutoSize = true;
            mainPanel.Controls.Add(lblUrlTitle);

            txtUrl = new TextBox();
            txtUrl.Text = "";
            txtUrl.Location = new Point(0, 30);
            txtUrl.Size = new Size(456, 26);
            txtUrl.BackColor = Color.FromArgb(15, 23, 42); // #0F172A
            txtUrl.ForeColor = Color.White;
            txtUrl.BorderStyle = BorderStyle.FixedSingle;
            mainPanel.Controls.Add(txtUrl);

            Label lblUrlHelp = new Label();
            lblUrlHelp.Text = "Leave blank for offline standalone mode (recommended), or enter custom hosted URL.";
            lblUrlHelp.Font = new Font("Segoe UI", 8F);
            lblUrlHelp.ForeColor = Color.FromArgb(148, 163, 184);
            lblUrlHelp.Location = new Point(0, 58);
            lblUrlHelp.AutoSize = true;
            mainPanel.Controls.Add(lblUrlHelp);

            chkDesktop = new CheckBox();
            chkDesktop.Text = "Create Desktop Shortcut";
            chkDesktop.Checked = true;
            chkDesktop.Location = new Point(0, 95);
            chkDesktop.AutoSize = true;
            mainPanel.Controls.Add(chkDesktop);

            chkStartMenu = new CheckBox();
            chkStartMenu.Text = "Create Start Menu Shortcut";
            chkStartMenu.Checked = true;
            chkStartMenu.Location = new Point(0, 125);
            chkStartMenu.AutoSize = true;
            mainPanel.Controls.Add(chkStartMenu);

            lblStatus = new Label();
            lblStatus.Text = "Ready to install. Click Install & Launch below.";
            lblStatus.ForeColor = Color.FromArgb(52, 211, 153); // #34D399 (Emerald)
            lblStatus.Location = new Point(0, 165);
            lblStatus.AutoSize = true;
            mainPanel.Controls.Add(lblStatus);

            // Bottom Buttons
            btnInstall = new Button();
            btnInstall.Text = "Install & Launch";
            btnInstall.Size = new Size(140, 38);
            btnInstall.Location = new Point(340, 330);
            btnInstall.BackColor = Color.FromArgb(37, 99, 235); // #2563EB
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            btnInstall.Cursor = Cursors.Hand;
            btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(btnInstall);

            Button btnCancel = new Button();
            btnCancel.Text = "Cancel";
            btnCancel.Size = new Size(90, 38);
            btnCancel.Location = new Point(238, 330);
            btnCancel.BackColor = Color.FromArgb(30, 41, 59); // #1E293B
            btnCancel.ForeColor = Color.White;
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            btnInstall.Enabled = false;
            lblStatus.Text = "Installing Vocal Remover...";
            lblStatus.ForeColor = Color.FromArgb(96, 165, 250); // #60A5FA
            Application.DoEvents();

            try
            {
                string targetDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    @"Programs\VocalRemover"
                );

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                // 1. Extract embedded VocalRemover.exe
                string exePath = Path.Combine(targetDir, "VocalRemover.exe");
                ExtractEmbeddedFile("VocalRemover.exe", exePath);

                // 2. Extract embedded app.ico
                string icoPath = Path.Combine(targetDir, "app.ico");
                try
                {
                    ExtractEmbeddedFile("app.ico", icoPath);
                }
                catch { }

                // 3. Extract and unpack embedded dist.zip (standalone web app assets)
                string tempZip = Path.Combine(targetDir, "dist.zip");
                string distDir = Path.Combine(targetDir, "dist");
                try
                {
                    ExtractEmbeddedFile("dist.zip", tempZip);
                    if (File.Exists(tempZip))
                    {
                        if (Directory.Exists(distDir))
                        {
                            try { Directory.Delete(distDir, true); } catch { }
                        }
                        ZipFile.ExtractToDirectory(tempZip, distDir);
                        File.Delete(tempZip);
                    }
                }
                catch { }

                // 4. Write uninstaller copy
                string uninstallerPath = Path.Combine(targetDir, "Uninstall.exe");
                File.Copy(Application.ExecutablePath, uninstallerPath, true);

                // 5. Write config.txt
                string configPath = Path.Combine(targetDir, "config.txt");
                File.WriteAllText(configPath, txtUrl.Text.Trim());

                string shortcutIcon = File.Exists(icoPath) ? icoPath : exePath;

                // 6. Create Desktop Shortcut
                if (chkDesktop.Checked)
                {
                    string desktopLnk = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                        "Vocal Remover.lnk"
                    );
                    CreateShortcut(desktopLnk, exePath, shortcutIcon, "Vocal Remover - Extract Karaoke & Separate Vocals");
                }

                // 7. Create Start Menu Shortcut
                if (chkStartMenu.Checked)
                {
                    string startMenuDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                        @"Programs"
                    );
                    string startLnk = Path.Combine(startMenuDir, "Vocal Remover.lnk");
                    CreateShortcut(startLnk, exePath, shortcutIcon, "Vocal Remover");
                }

                // 8. Register Uninstaller in Windows Registry
                RegisterUninstaller(targetDir, exePath, uninstallerPath);

                lblStatus.Text = "Installation complete! Launching Vocal Remover...";
                lblStatus.ForeColor = Color.FromArgb(52, 211, 153);
                Application.DoEvents();

                // 9. Launch the installed app
                Process.Start(exePath);

                Timer t = new Timer();
                t.Interval = 1200;
                t.Tick += (s, ev) =>
                {
                    t.Stop();
                    this.Close();
                };
                t.Start();
            }
            catch (Exception ex)
            {
                btnInstall.Enabled = true;
                lblStatus.Text = "Installation failed: " + ex.Message;
                lblStatus.ForeColor = Color.FromArgb(244, 63, 94);
                MessageBox.Show(
                    "Installation Error:\n" + ex.Message,
                    "Vocal Remover Setup",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private void ExtractEmbeddedFile(string resourceName, string outputPath)
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            using (Stream stream = assembly.GetManifestResourceStream(resourceName))
            {
                if (stream == null)
                {
                    // Fallback to checking local directory if not embedded
                    string localFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, resourceName);
                    if (File.Exists(localFile))
                    {
                        File.Copy(localFile, outputPath, true);
                        return;
                    }
                    throw new FileNotFoundException("Could not find payload resource: " + resourceName);
                }

                using (FileStream fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write))
                {
                    byte[] buffer = new byte[81920];
                    int bytesRead;
                    while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        fs.Write(buffer, 0, bytesRead);
                    }
                }
            }
        }

        private void CreateShortcut(string shortcutPath, string targetExe, string iconLocation, string description)
        {
            try
            {
                string script = string.Format(
                    "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{0}'); $s.TargetPath = '{1}'; $s.IconLocation = '{2}'; $s.Description = '{3}'; $s.Save()",
                    shortcutPath.Replace("'", "''"),
                    targetExe.Replace("'", "''"),
                    iconLocation.Replace("'", "''"),
                    description.Replace("'", "''")
                );

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command \"" + script + "\"";
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(4000);
                }
            }
            catch { }
        }

        private void RegisterUninstaller(string installDir, string exePath, string uninstallerPath)
        {
            try
            {
                string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\VocalRemover";
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(keyPath))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "Vocal Remover");
                        key.SetValue("DisplayIcon", exePath);
                        key.SetValue("DisplayVersion", "1.3.0");
                        key.SetValue("Publisher", "Ayesha Tech Studio");
                        key.SetValue("InstallLocation", installDir);
                        key.SetValue("UninstallString", string.Format("\"{0}\" /uninstall", uninstallerPath));
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }
    }
}
