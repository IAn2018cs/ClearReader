class CleanReader {
  constructor() {
    this.originalContent = null;
    this.readerMode = false;
  }

  init() {
    // 监听来自 background 的消息
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

    // 创建 Readability 实例获取基础信息
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    const article = reader.parse();

    // 解析文章内容
    const { content, headings } = this._parseContent();

    // 生成目录
    const toc = this._generateTOC(headings);

    // 计算阅读时间和字数
    const wordCount = content.textContent.length;
    const readingTime = Math.ceil(wordCount / 400);

    // 创建阅读视图
    const readerContent = `
        <div id="clean-reader-container">
          <div class="reader-sidebar">
            <div class="article-info">
              <p>预计阅读时间: ${readingTime} 分钟</p>
              <p>文章总字数: ${wordCount} 字</p>
            </div>
            <div class="toc">
              <div class="toc-title">目录</div>
              ${toc}
            </div>
          </div>
  
          <div class="reader-content">
            ${content.innerHTML}
          </div>
  
          <div class="reader-toolbar">
            <div class="toolbar-btn" id="reader-close" title="关闭阅读模式">
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
              </svg>
            </div>
            <div class="toolbar-btn" id="reader-settings" title="设置">
              <svg viewBox="0 0 24 24">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
            </div>
          </div>
        </div>
      `;

    document.body.innerHTML = readerContent;
    this._bindEvents();
  }

  _parseContent() {
    // 创建一个新的容器
    const contentContainer = document.createElement('div');
    const headings = [];

    // 获取主要内容区域
    const mainContent = this._findMainContent();

    // 深度遍历处理内容
    this._processNode(mainContent, contentContainer, headings);

    return { content: contentContainer, headings };
  }

  _findMainContent() {
    // 常见的主要内容容器选择器
    const selectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      'main',
    ];

    // 尝试找到主要内容容器
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    // 如果找不到特定容器，使用启发式方法
    return this._findContentByHeuristics();
  }

  _findContentByHeuristics() {
    // 获取所有段落
    const paragraphs = document.getElementsByTagName('p');

    // 找到包含最多文本内容的容器
    let maxTextLength = 0;
    let bestContainer = document.body;

    for (const p of paragraphs) {
      const parent = p.parentElement;
      const textLength = parent.textContent.length;

      if (textLength > maxTextLength) {
        maxTextLength = textLength;
        bestContainer = parent;
      }
    }

    return bestContainer;
  }

  _processNode(node, container, headings) {
    // 如果是文本节点，直接添加
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) {
        container.appendChild(node.cloneNode());
      }
      return;
    }

    // 如果不是元素节点，跳过
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // 跳过不需要的元素
    if (this._shouldSkipElement(node)) return;

    // 处理标题
    if (/^H[1-6]$/.test(node.tagName)) {
      const headingInfo = {
        level: parseInt(node.tagName.substring(1)),
        text: node.textContent.trim(),
        id: `heading-${headings.length}`
      };
      headings.push(headingInfo);
    }

    // 创建新元素
    const newElement = this._createCleanElement(node);

    // 处理子节点
    for (const child of node.childNodes) {
      this._processNode(child, newElement, headings);
    }

    // 如果处理后的元素有内容，添加到容器中
    if (newElement.textContent.trim() || newElement.tagName === 'IMG') {
      container.appendChild(newElement);
    }
  }

  _shouldSkipElement(element) {
    // 跳过的标签
    const skipTags = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'ads', 'iframe'];

    // 跳过的类名关键词
    const skipClassKeywords = ['nav', 'menu', 'sidebar', 'ad', 'header', 'footer', 'comment'];

    // 检查标签
    if (skipTags.includes(element.tagName.toLowerCase())) return true;

    // 检查类名
    if (element.className && typeof element.className === 'string') {
      return skipClassKeywords.some(keyword =>
        element.className.toLowerCase().includes(keyword)
      );
    }

    return false;
  }

  _createCleanElement(originalElement) {
    // 允许的标签
    const allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'];

    const tagName = originalElement.tagName.toLowerCase();
    const newElement = document.createElement(
      allowedTags.includes(tagName) ? tagName : 'p'
    );

    // 处理图片
    if (tagName === 'img') {
      newElement.src = originalElement.src;
      newElement.alt = originalElement.alt;
      return newElement;
    }

    // 处理链接
    if (tagName === 'a') {
      newElement.href = originalElement.href;
      newElement.target = '_blank';
      newElement.rel = 'noopener noreferrer';
    }

    // 复制必要的样式属性
    this._copyStyles(originalElement, newElement);

    return newElement;
  }

  _copyStyles(source, target) {
    // 需要保留的样式属性
    const allowedStyles = ['font-weight', 'font-style', 'text-decoration'];

    const computedStyle = window.getComputedStyle(source);
    allowedStyles.forEach(style => {
      const value = computedStyle.getPropertyValue(style);
      if (value && value !== 'normal') {
        target.style[style] = value;
      }
    });
  }

  _generateTOC(headings) {
    return headings.map(heading =>
      `<div class="toc-item" style="padding-left: ${(heading.level - 1) * 12}px" data-id="${heading.id}">
          ${heading.text}
        </div>`
    ).join('');
  }

  _bindEvents() {
    // 关闭按钮
    document.getElementById('reader-close').addEventListener('click', () => {
      this.disableReaderMode();
      this.readerMode = false;  // 更新阅读模式状态
    });

    // 目录点击
    document.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
      });
    });

    // 监听滚动以更新目录激活状态
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('.toc-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
          });
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      observer.observe(heading);
    });
  }

  disableReaderMode() {
    // 恢复原始内容
    if (this.originalContent) {
      document.body.innerHTML = this.originalContent;
      // 通知 background.js 更新图标状态
      chrome.runtime.sendMessage({ action: "updateIcon", enabled: false });
    }
  }
}

// 初始化
const cleanReader = new CleanReader();
cleanReader.init();