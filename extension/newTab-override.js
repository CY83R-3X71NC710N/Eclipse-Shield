//=+=+=+=+=+=+=+=+=+=+=
//      Config
//=+=+=+=+=+=+=+=+=+=+=
let tabURL = "chrome-extension://cieilankhimefdbpgafdidcfmnnnbmaf/newtab.html"; // Enter the URL of the new "New Tab" page(you can use a extention url)

// Override with custom page
var TabOverride = function (id, url) {
    if (typeof url == "undefined") return;
    if (url.search(/(chrome|opera|vivaldi):\/.*\/startpage/ig) == -1) return;
    if (url.search(/(download|history|bookmark|extension|news)/ig) != -1) return;

    var parser = new URL(tabURL);

    chrome.tabs.create({ url: parser.href, active: true });
    chrome.tabs.remove(id);
    console.log("[📦] Created new tab on" + url);
};

// Event listener for tab creation
chrome.tabs.onCreated.addListener(function (tab) {
    TabOverride(tab.id, tab.url || tab.pendingUrl);
});
