// 防止脚本重复执行
if (window.webAgentSelectorActive) {
  console.log("选择脚本已在运行中。");
} else {
  window.webAgentSelectorActive = true;

  let lastHighlightedElement = null;
  let selectionActive = false; // 初始为false，等待start-selection消息
  let selectedCount = 0; // 记录已选择的元素数量
  let selectedElements = []; // 记录已选择的元素

  // -- Event Handlers --

  function handleMouseOver(event) {
    if (!selectionActive) return;
    // 移除上一个元素的高亮
    if (lastHighlightedElement) {
      lastHighlightedElement.classList.remove('web-agent-highlight');
    }
    // 高亮当前元素（如果还没有被选择过）
    if (!event.target.classList.contains('web-agent-selected')) {
      lastHighlightedElement = event.target;
      lastHighlightedElement.classList.add('web-agent-highlight');
    }
  }

  function handleMouseOut(event) {
    if (!selectionActive) return;
    if (event.target && !event.target.classList.contains('web-agent-selected')) {
      event.target.classList.remove('web-agent-highlight');
    }
    lastHighlightedElement = null;
  }

  function handleClick(event) {
    if (!selectionActive) return;

    // 阻止默认行为和事件冒泡
    event.preventDefault();
    event.stopPropagation();

    const clickedElement = event.target;

    // 忽略对 body 或 html 元素的点击
    if (clickedElement === document.body || clickedElement === document.documentElement) {
      console.log("无效选择：忽略对 BODY/HTML 的点击。");
      return;
    }
    
    // 忽略已经选择过的元素
    if (clickedElement.classList.contains('web-agent-selected')) {
      console.log("元素已经被选择过，忽略重复选择");
      return;
    }
    
    if (clickedElement) {
      selectedCount++;
      const selectedHtml = clickedElement.innerHTML;
      
      // 标记元素为已选择
      clickedElement.classList.remove('web-agent-highlight');
      clickedElement.classList.add('web-agent-selected');
      
      // 添加序号标记
      const marker = document.createElement('div');
      marker.className = 'web-agent-selection-marker';
      marker.textContent = selectedCount;
      marker.style.cssText = `
        position: absolute !important;
        top: -10px !important;
        left: -10px !important;
        background-color: #ff4444 !important;
        color: white !important;
        width: 20px !important;
        height: 20px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 12px !important;
        font-weight: bold !important;
        z-index: 10000 !important;
        pointer-events: none !important;
      `;
      
      // 设置相对定位以便放置标记
      const originalPosition = clickedElement.style.position;
      if (!originalPosition || originalPosition === 'static') {
        clickedElement.style.position = 'relative';
      }
      clickedElement.appendChild(marker);
      
      // 记录选择的元素
      selectedElements.push({
        element: clickedElement,
        marker: marker,
        html: selectedHtml,
        order: selectedCount
      });
      
      console.log(`元素已选择（第${selectedCount}个），发送到后台脚本`);
      
      // 收集当前页面信息
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        fullHTML: document.documentElement.outerHTML,
        htmlLength: document.documentElement.outerHTML.length,
        screenshot: null, // 截图需要在background中获取
        screenshotSize: null
      };
      
      // 安全检查：确保 chrome.runtime 可用
      if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: "element-selected",
            html: selectedHtml,
            order: selectedCount,
            isMultiSelect: true,
            pageInfo: pageInfo
          }, (response) => {
            if (response && response.success) {
              console.log(`第${selectedCount}个元素选择已确认，页面信息已保存`);
            }
          });
      } else {
          console.error("无法访问插件通信接口，请刷新页面后重试。");
      }
    }

    // 不退出选择模式，继续选择
    // cleanup(); // 注释掉这行，保持选择模式
  }

  function handleEscapeKey(event) {
      if (event.key === "Escape") {
          console.log("通过 ESC 键完成多选并退出选择模式。");
          finishMultiSelection();
      }
  }

  // 完成多选
  function finishMultiSelection() {
    console.log(`完成多选，共选择了 ${selectedCount} 个元素`);
    
    // 发送完成多选的消息
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: "multi-selection-finished",
        totalCount: selectedCount
      });
    }
    
    cleanup();
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
      lastHighlightedElement = null;
    }
    
    // 彻底清除所有高亮元素
    const highlightedElements = document.querySelectorAll('.web-agent-highlight');
    console.log(`清理过程中发现 ${highlightedElements.length} 个悬停高亮元素`);
    highlightedElements.forEach(el => {
      el.classList.remove('web-agent-highlight');
    });

    // 注意：这里不清除选中状态，因为用户可能还需要在popup中查看
    // 只移除序号标记，保留选中背景
    selectedElements.forEach(item => {
      if (item.marker && item.marker.parentNode) {
        item.marker.parentNode.removeChild(item.marker);
      }
    });

    // 注意：不移除消息监听器，保持页面能够响应后续的清除命令
    // 这样"新会话"等操作仍然可以清除页面上的高亮状态
    // if (chrome.runtime && chrome.runtime.onMessage) {
    //   chrome.runtime.onMessage.removeListener(handleBackgroundMessages);
    // }

    // 重置全局标记，允许脚本再次运行
    window.webAgentSelectorActive = false;
    
    console.log("清理过程完成");
  }

  // 清除所有选择状态
  function clearAllSelections() {
    console.log("清除所有选择状态");
    
    // 方法1：清除记录在selectedElements数组中的元素
    selectedElements.forEach(item => {
      if (item.element) {
        item.element.classList.remove('web-agent-selected');
        if (item.marker && item.marker.parentNode) {
          item.marker.parentNode.removeChild(item.marker);
        }
      }
    });
    
    // 方法2：确保清除页面上所有的选中元素（防止遗漏）
    const allSelectedElements = document.querySelectorAll('.web-agent-selected');
    console.log(`发现页面上还有 ${allSelectedElements.length} 个选中元素需要清除`);
    allSelectedElements.forEach(element => {
      element.classList.remove('web-agent-selected');
      
      // 移除该元素内的所有序号标记
      const markers = element.querySelectorAll('.web-agent-selection-marker');
      markers.forEach(marker => {
        if (marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      });
    });
    
    // 方法3：清除页面上所有孤立的序号标记（防止标记残留）
    const allMarkers = document.querySelectorAll('.web-agent-selection-marker');
    console.log(`发现页面上还有 ${allMarkers.length} 个序号标记需要清除`);
    allMarkers.forEach(marker => {
      if (marker.parentNode) {
        marker.parentNode.removeChild(marker);
      }
    });
    
    // 方法4：清除所有悬停高亮状态
    const allHighlightedElements = document.querySelectorAll('.web-agent-highlight');
    console.log(`发现页面上还有 ${allHighlightedElements.length} 个悬停高亮元素需要清除`);
    allHighlightedElements.forEach(element => {
      element.classList.remove('web-agent-highlight');
    });
    
    // 重置计数器和数组
    selectedCount = 0;
    selectedElements = [];
    
    console.log("所有高亮状态已清除完毕");
  }

  // 清除特定选择项的高亮状态
  function removeSpecificHighlight(globalOrder, selectionHtml) {
    console.log(`尝试清除全局序号 ${globalOrder} 的高亮状态`);
    
    let removed = false;
    
    // 方法1：通过HTML内容匹配查找元素
    selectedElements.forEach((item, index) => {
      if (item.html === selectionHtml) {
        console.log(`通过HTML内容匹配找到要清除的元素（索引 ${index}）`);
        
        // 移除选中样式和标记
        if (item.element) {
          item.element.classList.remove('web-agent-selected');
          if (item.marker && item.marker.parentNode) {
            item.marker.parentNode.removeChild(item.marker);
          }
        }
        
        // 从数组中移除
        selectedElements.splice(index, 1);
        removed = true;
        
        console.log(`成功清除第 ${globalOrder} 个选择项的高亮状态`);
        return;
      }
    });
    
    // 方法2：如果通过HTML匹配失败，尝试查找页面上所有相同内容的选中元素
    if (!removed) {
      console.log(`HTML匹配失败，尝试在页面上查找匹配的选中元素`);
      
      const allSelectedElements = document.querySelectorAll('.web-agent-selected');
      allSelectedElements.forEach(element => {
        if (element.innerHTML === selectionHtml) {
          console.log(`在页面上找到匹配的选中元素，准备清除`);
          
          // 移除选中样式
          element.classList.remove('web-agent-selected');
          
          // 查找并移除对应的序号标记
          const markers = element.querySelectorAll('.web-agent-selection-marker');
          markers.forEach(marker => {
            if (marker.parentNode) {
              marker.parentNode.removeChild(marker);
            }
          });
          
          removed = true;
          console.log(`成功清除页面上匹配的选中元素`);
        }
      });
    }
    
    if (!removed) {
      console.log(`未找到全局序号 ${globalOrder} 对应的选中元素`);
    }
    
    return removed;
  }

  // 处理来自后台脚本的消息
  function handleBackgroundMessages(message, sender, sendResponse) {
      console.log("Content script received message:", message);
      
      if (message.type === 'start-selection') {
          console.log("开始多选模式");
          selectionActive = true;
          
          // 获取全局选择数据，继续累加而不是重置
          chrome.storage.local.get('multiSelectionData', (data) => {
            const existingData = data.multiSelectionData;
            if (existingData && existingData.selections) {
              // 如果有现有选择，页面内序号从1开始，但显示全局累计数量
              selectedCount = 0; // 页面内计数
              console.log(`继续跨页面选择，当前已有${existingData.selections.length}个选择`);
            } else {
              selectedCount = 0;
              console.log("开始新的多选会话");
            }
            selectedElements = [];
          });
      } else if (message.type === 'stop-selection-mode' || message.type === 'cancel-selection') {
          console.log("停止选择模式");
          clearAllSelections();
          cleanup();
      } else if (message.type === 'get-page-html') {
          console.log("获取完整页面HTML");
          const fullHTML = document.documentElement.outerHTML;
          sendResponse(fullHTML);
          return true; // 保持消息通道开放
      } else if (message.type === 'finish-selection') {
          console.log("完成多选");
          finishMultiSelection();
      } else if (message.type === 'clear-page-state') {
          console.log("收到清除页面状态命令");
          clearAllSelections();
          // 注意：这里不调用cleanup()，因为我们只需要清除高亮状态，不需要清理选择模式
          // cleanup();
      } else if (message.type === 'remove-specific-highlight') {
          console.log("收到清除特定高亮的命令:", message);
          const removed = removeSpecificHighlight(message.globalOrder, message.selectionHtml);
          sendResponse({ success: removed });
          return true; // 保持消息通道开放
      }
  }

  // -- Main Logic --
  console.log("多选元素选择脚本已加载，等待开始信号");

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