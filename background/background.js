// background/background.js

// 全局状态管理
let tabSelectionState = {}; // 跟踪每个标签页的选择状态

// 插件图标点击事件
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked on tab:", tab.id);
  
  // 检查当前标签页是否已经在选择模式
  if (tabSelectionState[tab.id]) {
    console.log("Tab already in selection mode, ignoring click");
    return;
  }
  
  // 设置该标签页为选择模式
  tabSelectionState[tab.id] = true;
  
  // 注入内容脚本
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content/content_script.js']
  }).then(() => {
    console.log("Content script injected successfully");
    
    // 注入CSS样式
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content/content_style.css']
    }).then(() => {
      console.log("CSS injected successfully");
      
      // 向内容脚本发送开始选择的消息
      chrome.tabs.sendMessage(tab.id, { type: "start-selection" });
    }).catch(err => {
      console.error("Failed to inject CSS:", err);
    });
  }).catch(err => {
    console.error("Failed to inject content script:", err);
  });
});

// 监听来自 content script 和 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  if (message.type === "element-selected") {
    // 存储选中的元素HTML到本地存储
    chrome.storage.local.set({ 
      lastSelectionHTML: message.html 
    }, () => {
      console.log("Element HTML saved to storage");
      
      // 设置popup页面
      chrome.action.setPopup({ popup: "popup/popup.html" });
      
      // 设置角标提示
      if (sender.tab) {
        chrome.action.setBadgeText({ text: '✓', tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: sender.tab.id });
        
        // 重置该标签页的选择状态
        tabSelectionState[sender.tab.id] = false;
      }
      
      console.log("插件状态已更新，popup已设置");
    });
    
    // 向所有标签页发送停止选择模式的消息
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: "stop-selection-mode" }).catch(() => {
          // 忽略错误，某些标签页可能没有content script
        });
      });
    });
    
    sendResponse({ success: true });
  } else if (message.type === "cancel-all") {
    // 向所有标签页发送停止选择模式的消息
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: "stop-selection-mode" }).catch(() => {
          // 忽略错误，某些标签页可能没有content script
        });
      });
    });
    
    // 清理存储的选择内容
    chrome.storage.local.remove('lastSelectionHTML');
    
    // 重置插件状态
    chrome.action.setPopup({ popup: "" }); // 移除popup
    chrome.action.setBadgeText({ text: "" }); // 清除角标
    
    // 重置所有标签页的选择状态
    tabSelectionState = {};
    
    console.log("插件状态已重置到初始状态");
    
    sendResponse({ success: true });
  } else if (message.type === "call-ai") {
    // 处理 AI 调用请求
    handleAICall(message, sendResponse);
    return true; // 保持消息通道开放以进行异步响应
  }
});

// 处理 AI 调用
async function handleAICall(message, sendResponse) {
  try {
    console.log("开始处理 AI 调用:", message);
    
    // 获取设置（优先使用临时模型选择）
    const settings = await new Promise((resolve) => {
      chrome.storage.local.get(['tempModelName'], (localData) => {
        chrome.storage.sync.get([
          'openaiApiKey', 
          'modelName', 
          'temperature', 
          'maxTokens'
        ], (syncData) => {
          // 如果有临时模型选择，优先使用
          if (localData.tempModelName) {
            syncData.modelName = localData.tempModelName;
          }
          resolve(syncData);
        });
      });
    });
    
    const { openaiApiKey, modelName, temperature, maxTokens } = settings;
    console.log("当前设置:", { 
      hasOpenAIKey: !!openaiApiKey,
      modelName: modelName || 'gpt-4.1-mini',
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 16384
    });
    
    if (!openaiApiKey) {
      throw new Error('未配置 OpenAI API Key，请前往设置页面配置');
    }
    
    console.log("开始调用 OpenAI API...");
    const result = await callOpenAIAPI(
      openaiApiKey, 
      message.fullPrompt,
      modelName || 'gpt-4.1-mini',
      temperature || 0.7,
      maxTokens || 16384
    );
    
    console.log("AI 调用成功:", result);
    sendResponse({ success: true, result: result });
    
  } catch (error) {
    console.error("AI 调用失败:", error);
    
    // 提供更详细的错误信息
    let errorMessage = error.message;
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      errorMessage = `网络请求失败，可能的原因：
1. 网络连接问题
2. 防火墙或代理阻止了请求
3. API 服务暂时不可用
4. 需要科学上网访问服务
5. API Key 可能无效

原始错误: ${error.message}`;
    }
    
    sendResponse({ success: false, error: errorMessage });
  }
}

// 调用 OpenAI API
async function callOpenAIAPI(apiKey, prompt, modelName = 'gpt-4.1-mini', temperature = 0.7, maxTokens = 16384) {
  console.log("开始调用 OpenAI API...");
  console.log("API Key 长度:", apiKey ? apiKey.length : 0);
  console.log("Prompt 长度:", prompt.length);
  console.log("模型参数:", { modelName, temperature, maxTokens });
  
  const url = 'https://4.0.wokaai.com/v1/chat/completions';
  const requestBody = {
    model: modelName,
    messages: [{
      role: 'user',
      content: prompt
    }],
    max_tokens: maxTokens,
    temperature: temperature
  };
  
  console.log("请求 URL:", url);
  console.log("请求体大小:", JSON.stringify(requestBody).length, "字符");
  
  try {
    // 创建超时控制器 - 根据内容长度动态设置超时时间
    const timeoutMs = Math.max(60000, Math.min(120000, prompt.length * 50)); // 60秒到2分钟之间
    console.log("设置超时时间:", timeoutMs, "毫秒");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log("OpenAI API 响应状态:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API 错误响应:", errorText);
      throw new Error(`OpenAI API 调用失败: ${response.status} ${response.statusText}\n详细错误: ${errorText}`);
    }
    
    const data = await response.json();
    console.log("OpenAI API 响应数据结构:", Object.keys(data));
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const result = data.choices[0].message.content;
      console.log("OpenAI API 调用成功，结果长度:", result.length);
      return result;
    } else {
      console.error("OpenAI API 返回了意外的响应格式:", data);
      throw new Error('OpenAI API 返回了意外的响应格式');
    }
  } catch (error) {
    console.error("OpenAI API 调用异常:", error);
    
    if (error.name === 'AbortError') {
      throw new Error(`OpenAI API 请求超时，内容较多需要更长时间处理。\n建议：\n1. 尝试减少选中内容的长度\n2. 简化 Prompt 内容\n3. 稍后重试`);
    }
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败，请检查：\n1. 网络连接是否正常\n2. 是否能访问 OpenAI 服务\n3. 防火墙或代理设置\n4. API Key 是否有效\n5. 是否需要科学上网');
    }
    
    throw error;
  }
}
