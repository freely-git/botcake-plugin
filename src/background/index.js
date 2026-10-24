chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "https://botcake.io/dashboard?self_page_botcake_extension"
  });
});
