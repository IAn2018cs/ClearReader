class CleanReader {
    constructor() {
      this.originalContent = null;
      this.readerMode = false;
    }
  
    init() {
      // 监听来自 popup 的消息
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleReader') {
          this.toggleReader();
        }
      });
    }
  
    toggleReader() {
      if (!this.readerMode) {
        this.enableReaderMode();
      } else {
        this.disableReaderMode();
      }
      this.readerMode = !this.readerMode;
    }
  
    enableReaderMode() {
      // 保存原始内容
      this.originalContent = document.body.innerHTML;
  
      // 创建 Readability 实例
      const documentClone = document.cloneNode(true);
      const reader = new Readability(documentClone);
      const article = reader.parse();
  
      // 创建阅读视图
      const readerContent = `
        <div id="clean-reader-container">
          <div class="reader-content">
            <h1>${article.title}</h1>
            ${article.content}
          </div>
        </div>
      `;
  
      document.body.innerHTML = readerContent;
    }
  
    disableReaderMode() {
      // 恢复原始内容
      if (this.originalContent) {
        document.body.innerHTML = this.originalContent;
      }
    }
  }
  
  // 初始化
  const cleanReader = new CleanReader();
  cleanReader.init();