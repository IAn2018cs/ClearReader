let readerEnabled = {}; // 存储每个标签页的阅读模式状态

// 监听图标点击
chrome.action.onClicked.addListener(async (tab) => {
  // 切换状态
  readerEnabled[tab.id] = !readerEnabled[tab.id];
  
  // 更新图标
  await updateIcon(tab.id, readerEnabled[tab.id]);

  // 发送消息给content script
  chrome.tabs.sendMessage(tab.id, { action: "toggleReader" });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener(async (request, sender) => {
  if (request.action === "updateIcon") {
    const tabId = sender.tab.id;
    readerEnabled[tabId] = request.enabled;
    await updateIcon(tabId, request.enabled);
  }
});

// 抽取更新图标的函数
async function updateIcon(tabId, enabled) {
  await chrome.action.setIcon({
    path: {
      32: enabled ? "icons/icon-dark.png" : "icons/icon-light.png",
      128: enabled ? "icons/icon-dark.png" : "icons/icon-light.png"
    },
    tabId: tabId
  });
}

// 监听标签页关闭,清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
  delete readerEnabled[tabId];
});