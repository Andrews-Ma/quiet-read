using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
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
    private string lastThemeColor = "";

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int valueSize);

    private void ApplyTitleBar(string color, bool dark)
    {
        if (color.Length != 7 || color[0] != '#' || !int.TryParse(color.AsSpan(1), System.Globalization.NumberStyles.HexNumber, null, out int rgb)) return;
        int immersiveDark = dark ? 1 : 0;
        int caption = ((rgb & 0xff) << 16) | (rgb & 0x00ff00) | ((rgb >> 16) & 0xff);
        int text = dark ? 0x00ffffff : 0x00202020;
        DwmSetWindowAttribute(Handle, 20, ref immersiveDark, sizeof(int));
        // Caption and text colors are supported on Windows 11; older versions use system colors.
        DwmSetWindowAttribute(Handle, 35, ref caption, sizeof(int));
        DwmSetWindowAttribute(Handle, 36, ref text, sizeof(int));
    }


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
            core.WebMessageReceived += (_, e) =>
            {
                if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var origin) || origin.Scheme != "https" || origin.Host != AppHost) return;
                try
                {
                    using var message = JsonDocument.Parse(e.WebMessageAsJson);
                    var root = message.RootElement;
                    if (root.GetProperty("op").GetString() == "setTheme")
                    {
                        lastThemeColor = root.GetProperty("color").GetString() ?? "";
                        ApplyTitleBar(lastThemeColor, root.GetProperty("dark").GetBoolean());
                    }
                }
                catch (JsonException) { }
                catch (InvalidOperationException) { }
                catch (KeyNotFoundException) { }
            };
            core.ContainsFullScreenElementChanged += (_, _) => SetFullScreen(core.ContainsFullScreenElement);
            if (smokeTest)
            {
                core.NavigationCompleted += async (_, e) =>
                {
                    try
                    {
                        if (!e.IsSuccess) throw new InvalidOperationException("Page navigation failed.");
                        await Task.Delay(1000);
                        string result = await core.ExecuteScriptAsync("(() => { const picker = document.getElementById('theme'); if (!picker || document.getElementById('play').disabled) return 'failed'; picker.value = 'blue'; picker.dispatchEvent(new Event('change', { bubbles: true })); return getComputedStyle(document.documentElement).getPropertyValue('--ui-bar').trim(); })()");
                        await Task.Delay(500);
                        string saved = await core.ExecuteScriptAsync("JSON.parse(localStorage.getItem('quietprompt-v3:state') || '{}').prefs?.theme || ''");
                        if (result != "\"#c3e4f8\"" || saved != "\"blue\"" || lastThemeColor != "#c3e4f8")
                            throw new InvalidOperationException("Theme, title bar, or storage check failed.");
                        string settingsCheck = await core.ExecuteScriptAsync("""
                            (() => {
                              const el = id => document.getElementById(id);
                              const expect = (condition, message) => { if (!condition) throw new Error(message); };
                              const speeds = () => [...document.querySelectorAll('[data-speed]')].map(b => b.textContent).join(',');
                              const outside = id => {
                                const box = el(id).getBoundingClientRect();
                                const layer = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
                                expect(layer?.id === 'panelBackdrop', `Settings did not cover ${id}`);
                                layer.click();
                              };
                              el('settings').click();
                              const closeBottom = el('close').getBoundingClientRect().bottom;
                              const dividerTop = document.querySelector('.settings-group').getBoundingClientRect().top;
                              expect(dividerTop - closeBottom >= 8, 'Close button overlaps the divider');
                              el('speedMin').value = '100'; el('speedMax').value = '300';
                              el('paste').value = 'An example draft';
                              const title = el('title').textContent, position = el('position').textContent;
                              outside('play');
                              expect(el('panel').hidden && el('play').textContent === 'Start', 'Outside click started reading');
                              expect(speeds() === '100,140,180,220,260,300', 'Valid range was not applied');
                              expect(el('title').textContent === title && el('paste').value === 'An example draft', 'Draft was loaded or lost');
                              el('settings').click();
                              el('speedMin').value = '300'; el('speedMax').value = '100';
                              outside('next');
                              expect(!el('panel').hidden && el('speedRangeMessage').textContent.includes('maximum greater'), 'Invalid range closed settings');
                              expect(el('position').textContent === position && speeds() === '100,140,180,220,260,300', 'Invalid range changed progress or speeds');
                              el('close').click();
                              expect(!el('panel').hidden, 'Close ignored the invalid range');
                              el('speedMin').value = '120'; el('speedMax').value = '';
                              outside('seek');
                              expect(!el('panel').hidden && el('speedRangeMessage').textContent.includes('both'), 'Missing bound was accepted');
                              el('speedMax').value = '240';
                              el('speedMax').dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape', bubbles: true}));
                              expect(el('panel').hidden && speeds() === '120,144,168,192,216,240', 'Escape did not apply the valid range');
                              expect(el('title').textContent === title && el('paste').value === 'An example draft', 'Closing changed the draft or current script');
                              return 'passed';
                            })()
                            """);
                        await Task.Delay(500);
                        string speedSaved = await core.ExecuteScriptAsync("(() => { const p = JSON.parse(localStorage.getItem('quietprompt-v3:state') || '{}').prefs; return p ? `${p.speedMin},${p.speedMax}` : ''; })()");
                        if (settingsCheck != "\"passed\"" || speedSaved != "\"120,240\"")
                            throw new InvalidOperationException("Settings dismissal or saved speed range check failed: " + settingsCheck);
                        await core.ExecuteScriptAsync("""window.importNovel('# Sample\n\nHello **there**.', 'sample.md')""");
                        await Task.Delay(500);
                        string importCheck = await core.ExecuteScriptAsync("""
                            (() => {
                              const el = id => document.getElementById(id);
                              if (!el('banner').hidden || el('title').textContent !== 'sample.md' || el('text').textContent !== 'Hello there.') return 'failed';
                              el('settings').click();
                              return el('books').selectedOptions[0]?.textContent === 'sample.md' && el('bookWarnings').textContent ? 'passed' : 'failed';
                            })()
                            """);
                        if (importCheck != "\"passed\"") throw new InvalidOperationException("Markdown import check failed: " + importCheck);
                        Environment.ExitCode = 0;
                    }
                    catch (Exception ex) { Console.Error.WriteLine(ex); Environment.ExitCode = 1; }
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
