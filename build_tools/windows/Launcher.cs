using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;

namespace VocalRemover
{
    static class Launcher
    {
        private static HttpListener _listener;
        private static string _webRoot;

        [STAThread]
        static void Main()
        {
            try
            {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string configFile = Path.Combine(appDir, "config.txt");
                string targetUrl = null;

                // 1. Check custom config.txt
                if (File.Exists(configFile))
                {
                    try
                    {
                        string line = File.ReadAllText(configFile).Trim();
                        if (!string.IsNullOrEmpty(line) && line.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                        {
                            targetUrl = line;
                        }
                    }
                    catch { }
                }

                // 2. Check active local engines and dev servers
                if (string.IsNullOrEmpty(targetUrl))
                {
                    if (IsServerResponding("http://127.0.0.1:8524"))
                    {
                        targetUrl = "http://127.0.0.1:8524";
                    }
                    else if (IsServerResponding("http://localhost:5173"))
                    {
                        targetUrl = "http://localhost:5173";
                    }
                    else
                    {
                        // Check if bundled or local dist folder exists
                        string distDir = Path.Combine(appDir, "dist");
                        if (!Directory.Exists(distDir))
                        {
                            DirectoryInfo parent = Directory.GetParent(appDir);
                            string parentPath = (parent != null) ? parent.FullName : "";
                            string parentDist = Path.Combine(parentPath, "dist");
                            if (Directory.Exists(parentDist)) distDir = parentDist;
                        }

                        if (Directory.Exists(distDir) && File.Exists(Path.Combine(distDir, "index.html")))
                        {
                            StartStaticServer(distDir, 8525);
                            targetUrl = "http://127.0.0.1:8525";
                        }
                        else
                        {
                            targetUrl = "http://localhost:5173";
                        }
                    }
                }

                // 3. Detect Edge or Chrome for clean borderless standalone application mode
                string edge64 = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                string edge32 = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
                string chrome64 = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
                string chrome32 = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";
                string chromeUser = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    @"Google\Chrome\Application\chrome.exe"
                );

                string browserExe = null;
                if (File.Exists(edge32)) browserExe = edge32;
                else if (File.Exists(edge64)) browserExe = edge64;
                else if (File.Exists(chrome64)) browserExe = chrome64;
                else if (File.Exists(chrome32)) browserExe = chrome32;
                else if (File.Exists(chromeUser)) browserExe = chromeUser;

                Process browserProc = null;
                if (!string.IsNullOrEmpty(browserExe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browserExe;
                    psi.Arguments = string.Format("--app=\"{0}\" --window-size=1200,850", targetUrl);
                    psi.UseShellExecute = false;
                    browserProc = Process.Start(psi);
                }
                else
                {
                    // Fallback to default browser
                    browserProc = Process.Start(targetUrl);
                }

                // If running local embedded static server, keep launcher alive while browser is active
                if (_listener != null && _listener.IsListening)
                {
                    if (browserProc != null)
                    {
                        browserProc.WaitForExit();
                    }
                    else
                    {
                        Thread.Sleep(300000);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Could not launch Vocal Remover:\n" + ex.Message,
                    "Vocal Remover",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            finally
            {
                if (_listener != null)
                {
                    try { _listener.Stop(); } catch { }
                }
            }
        }

        private static void StartStaticServer(string webRoot, int port)
        {
            try
            {
                _webRoot = webRoot;
                _listener = new HttpListener();
                _listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", port));
                _listener.Start();

                Thread serverThread = new Thread(() =>
                {
                    while (_listener != null && _listener.IsListening)
                    {
                        try
                        {
                            HttpListenerContext context = _listener.GetContext();
                            ThreadPool.QueueUserWorkItem((ctxObj) => HandleRequest((HttpListenerContext)ctxObj), context);
                        }
                        catch { break; }
                    }
                });
                serverThread.IsBackground = true;
                serverThread.Start();
            }
            catch { }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            try
            {
                string rawUrl = context.Request.Url.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(rawUrl)) rawUrl = "index.html";

                string filePath = Path.Combine(_webRoot, rawUrl.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(filePath))
                {
                    // SPA fallback to index.html for client-side routing
                    filePath = Path.Combine(_webRoot, "index.html");
                }

                byte[] data = File.ReadAllBytes(filePath);
                string ext = Path.GetExtension(filePath).ToLower();

                string mime = "application/octet-stream";
                if (ext == ".html" || ext == ".htm") mime = "text/html; charset=utf-8";
                else if (ext == ".js" || ext == ".mjs") mime = "application/javascript; charset=utf-8";
                else if (ext == ".css") mime = "text/css; charset=utf-8";
                else if (ext == ".json") mime = "application/json; charset=utf-8";
                else if (ext == ".svg") mime = "image/svg+xml";
                else if (ext == ".png") mime = "image/png";
                else if (ext == ".ico") mime = "image/x-icon";
                else if (ext == ".woff2") mime = "font/woff2";
                else if (ext == ".wav") mime = "audio/wav";

                context.Response.ContentType = mime;
                context.Response.ContentLength64 = data.Length;
                context.Response.OutputStream.Write(data, 0, data.Length);
                context.Response.OutputStream.Close();
            }
            catch
            {
                try
                {
                    context.Response.StatusCode = 500;
                    context.Response.Close();
                }
                catch { }
            }
        }

        private static bool IsServerResponding(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 500;
                req.Method = "HEAD";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
