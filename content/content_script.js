// 防止脚本重复执行
if (window.webAgentSelectorActive) {
  console.log("选择脚本已在运行中。");
} else {
  window.webAgentSelectorActive = true;

  let lastHighlightedElement = null;
  let selectionActive = false; // 初始为false，等待start-selection消息

  // -- Event Handlers --

  function handleMouseOver(event) {
    if (!selectionActive) return;
    // 移除上一个元素的高亮
    if (lastHighlightedElement) {
      lastHighlightedElement.classList.remove('web-agent-highlight');
    }
    // 高亮当前元素
    lastHighlightedElement = event.target;
    lastHighlightedElement.classList.add('web-agent-highlight');
  }

  function handleMouseOut(event) {
    if (!selectionActive) return;
    if (event.target) {
      event.target.classList.remove('web-agent-highlight');
    }
    lastHighlightedElement = null;
  }

  function handleClick(event) {
    if (!selectionActive) return;

    // 阻止默认行为和事件冒泡
    event.preventDefault();
    event.stopPropagation();
    
    // 立即禁用选择，防止重复点击
    selectionActive = false;

    const clickedElement = event.target;

    // 忽略对 body 或 html 元素的点击
    if (clickedElement === document.body || clickedElement === document.documentElement) {
      console.log("无效选择：忽略对 BODY/HTML 的点击。");
      cleanup();
      return;
    }
    
    if (clickedElement) {
      const selectedHtml = clickedElement.innerHTML;
      
      console.log("元素已选择，发送到后台脚本");
      
      // 安全检查：确保 chrome.runtime 可用
      if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: "element-selected",
            html: selectedHtml
          }, (response) => {
            if (response && response.success) {
              console.log("元素选择已确认");
            }
          });
      } else {
          console.error("无法访问插件通信接口，请刷新页面后重试。");
      }
    }

    cleanup();
  }

  function handleEscapeKey(event) {
      if (event.key === "Escape") {
          console.log("通过 ESC 键取消选择。");
          cleanup();
      }
  }

  // -- Core Functions --

  function cleanup() {
    console.log("清理并退出选择模式。");
    selectionActive = false;
    
    // 移除所有监听器
    window.removeEventListener('mouseover', handleMouseOver);
    window.removeEventListener('mouseout', handleMouseOut);
    window.removeEventListener('click', handleClick, true);
    window.removeEventListener('keydown', handleEscapeKey);

    // 移除残留的高亮
    if (lastHighlightedElement) {
      lastHighlightedElement.classList.remove('web-agent-highlight');
    }
    
    // 移除所有高亮元素
    const highlightedElements = document.querySelectorAll('.web-agent-highlight');
    highlightedElements.forEach(el => {
      el.classList.remove('web-agent-highlight');
    });

    // 安全地移除消息监听器
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(handleBackgroundMessages);
    }

    // 重置全局标记，允许脚本再次运行
    window.webAgentSelectorActive = false;
  }

  // 处理来自后台脚本的消息
  function handleBackgroundMessages(message, sender, sendResponse) {
      console.log("Content script received message:", message);
      
      if (message.type === 'start-selection') {
          console.log("开始选择模式");
          selectionActive = true;
      } else if (message.type === 'stop-selection-mode' || message.type === 'cancel-selection') {
          console.log("停止选择模式");
          cleanup();
      } else if (message.type === 'get-page-html') {
          console.log("获取完整页面HTML");
          const fullHTML = document.documentElement.outerHTML;
          sendResponse(fullHTML);
          return true; // 保持消息通道开放
      }
  }

  // -- Main Logic --
  console.log("元素选择脚本已加载，等待开始信号");

  // 将监听器附加到 window 对象，以获得最高优先级
  window.addEventListener('mouseover', handleMouseOver);
  window.addEventListener('mouseout', handleMouseOut);
  window.addEventListener('click', handleClick, true); // 使用捕获阶段
  window.addEventListener('keydown', handleEscapeKey);

  // 监听后台消息 (同样需要安全检查)
  if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleBackgroundMessages);
  }
} 