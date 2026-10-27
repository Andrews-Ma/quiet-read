using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace QuietRead;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new ReaderWindow(args.Contains("--smoke-test")));
    }
}

internal sealed class ReaderWindow : Form
{
    private const string AppHost = "quietread.local";
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly bool smokeTest;
    private readonly string dataRoot;
    private FormBorderStyle previousBorder;
    private FormWindowState previousState;
    private bool isFullscreen;

    public ReaderWindow(bool smokeTest)
    {
        this.smokeTest = smokeTest;
        dataRoot = smokeTest
            ? Path.Combine(Path.GetTempPath(), "QuietRead-smoke-" + Guid.NewGuid().ToString("N"))
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "QuietRead");
        Text = "QuietRead";
        Width = 1200;
        Height = 800;
        MinimumSize = new Size(680, 480);
        Controls.Add(web);
        Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            string content = Path.Combine(dataRoot, "app");
            Directory.CreateDirectory(content);
            using Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("QuietRead.index.html")
                ?? throw new InvalidOperationException("The reading interface is missing.");
            using (var output = File.Create(Path.Combine(content, "index.html"))) resource.CopyTo(output);
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataRoot, "WebView2"));
            await web.EnsureCoreWebView2Async(environment);
            var core = web.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping(AppHost, content, CoreWebView2HostResourceAccessKind.DenyCors);
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != AppHost)
                    e.Cancel = true;
            };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.ContainsFullScreenElementChanged += (_, _) => SetFullScreen(core.ContainsFullScreenElement);
            if (smokeTest)
            {
                core.NavigationCompleted += async (_, e) =>
                {
                    try
                    {
                        if (!e.IsSuccess) throw new InvalidOperationException("Page navigation failed.");
                        string result = await core.ExecuteScriptAsync("(() => { localStorage.setItem('smoke', 'ok'); return document.getElementById('play') && document.getElementById('language') && localStorage.getItem('smoke') === 'ok' ? 'ok' : 'failed'; })()");
                        if (result != "\"ok\"") throw new InvalidOperationException("Interface or storage check failed: " + result);
                        Environment.ExitCode = 0;
                    }
                    catch { Environment.ExitCode = 1; }
                    Close();
                };
            }
            core.Navigate($"https://{AppHost}/index.html");
        }
        catch (Exception ex)
        {
            Environment.ExitCode = 1;
            if (!smokeTest) MessageBox.Show("QuietRead could not start. Check that Microsoft Edge WebView2 Runtime is installed.\n\n" + ex.Message,
                "QuietRead", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private void SetFullScreen(bool fullScreen)
    {
        if (fullScreen == isFullscreen) return;
        isFullscreen = fullScreen;
        if (fullScreen)
        {
            previousState = WindowState;
            previousBorder = FormBorderStyle;
            WindowState = FormWindowState.Normal;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
        }
        else
        {
            WindowState = FormWindowState.Normal;
            FormBorderStyle = previousBorder;
            WindowState = previousState;
        }
    }
}
