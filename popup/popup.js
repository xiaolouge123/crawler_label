// popup/js/popup.js

// HTML 清洗函数
function cleanHTML(htmlString) {
  console.log("=== 开始清洗HTML ===");
  console.log("输入HTML长度:", htmlString.length);
  console.log("输入HTML内容（前100字符）:", htmlString.substring(0, 100));
  
  if (!htmlString || htmlString.trim() === '') {
    console.log("HTML内容为空，返回空字符串");
    return '';
  }

  // 创建临时DOM元素来解析HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;
  
  // 移除所有 script 和 style 标签
  const scriptsAndStyles = tempDiv.querySelectorAll('script, style');
  scriptsAndStyles.forEach(element => element.remove());
  
  let cleanedText = '';
  
  // 递归处理所有节点
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // 文本节点：直接添加文本内容
      let text = node.textContent.trim();
      
      // 过滤掉看起来像JavaScript代码的文本
      if (text && !isJavaScriptCode(text)) {
        cleanedText += text + ' ';
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // 跳过 script 和 style 标签
      if (tagName === 'script' || tagName === 'style') {
        return;
      }
      
      if (tagName === 'a') {
        // 链接：保留文本和URL，但过滤掉 javascript: 链接
        const linkText = node.textContent.trim();
        const href = node.getAttribute('href');
        
        if (linkText && href && !href.startsWith('javascript:')) {
          // 只保留有效的 HTTP/HTTPS 链接
          if (href.startsWith('http') || href.startsWith('/') || href.startsWith('#')) {
            cleanedText += `${linkText} [链接: ${href}] `;
          } else {
            cleanedText += linkText + ' ';
          }
        } else if (linkText && !isJavaScriptCode(linkText)) {
          cleanedText += linkText + ' ';
        }
      } else if (tagName === 'img') {
        // 图片：保留alt文本和src
        const alt = node.getAttribute('alt') || '图片';
        const src = node.getAttribute('src');
        if (src && (src.startsWith('http') || src.startsWith('/') || src.startsWith('data:'))) {
          cleanedText += `[${alt}: ${src}] `;
        }
      } else if (['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'].includes(tagName)) {
        // 块级元素：处理子节点后添加换行
        for (let child of node.childNodes) {
          processNode(child);
        }
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          cleanedText += '\n\n'; // 标题后添加双换行
        } else {
          cleanedText += '\n';
        }
      } else if (tagName === 'ul' || tagName === 'ol') {
        // 列表：添加标识
        cleanedText += '\n';
        for (let child of node.childNodes) {
          processNode(child);
        }
        cleanedText += '\n';
      } else if (tagName === 'table') {
        // 表格：添加表格标识
        cleanedText += '\n--- 表格开始 ---\n';
        for (let child of node.childNodes) {
          processNode(child);
        }
        cleanedText += '--- 表格结束 ---\n\n';
      } else if (tagName === 'tr') {
        // 表格行：处理完所有单元格后换行
        for (let child of node.childNodes) {
          processNode(child);
        }
        cleanedText += '\n';
      } else if (tagName === 'td' || tagName === 'th') {
        // 表格单元格：用制表符分隔
        for (let child of node.childNodes) {
          processNode(child);
        }
        cleanedText += '\t';  // 用制表符分隔单元格
      } else {
        // 其他元素：递归处理子节点
        for (let child of node.childNodes) {
          processNode(child);
        }
      }
    }
  }
  
  // 判断文本是否看起来像JavaScript代码
  function isJavaScriptCode(text) {
    // 常见的JavaScript模式
    const jsPatterns = [
      /function\s*\w*\s*\(/,  // function 声明
      /\$\(function\(/,       // jQuery
      /document\./,           // DOM操作
      /window\./,             // window对象
      /\.style\./,            // 样式操作
      /getElementById/,       // DOM查询
      /addEventListener/,     // 事件监听
      /console\./,            // 控制台
      /var\s+\w+\s*=/,       // 变量声明
      /if\s*\(/,             // if语句
      /for\s*\(/,            // for循环
      /\w+\s*=\s*function/,  // 函数赋值
      /\{\s*\}/,             // 空对象
      /\[\s*\]/,             // 空数组
      /javascript:/,          // javascript协议
      /onclick\s*=/,         // 事件属性
      /onload\s*=/,          // 事件属性
    ];
    
    return jsPatterns.some(pattern => pattern.test(text));
  }
  
  processNode(tempDiv);
  
  // 清理多余的空白字符和换行
  let result = cleanedText
    .replace(/[ ]+/g, ' ')  // 多个空格合并为一个空格（保留制表符）
    .replace(/\n[ ]+/g, '\n')  // 移除行首的空格（保留制表符）
    .replace(/[ ]+\n/g, '\n')  // 移除行尾的空格（保留制表符）
    .replace(/\t+/g, '\t')  // 多个制表符合并为一个
    .replace(/\t\n/g, '\n')  // 移除行尾的制表符
    .replace(/\n{3,}/g, '\n\n')  // 多个换行最多保留两个
    .trim();
  
  // 进一步清理：移除单独的符号行和无意义的短文本
  result = result.split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // 对于包含制表符的行（可能是表格行），放宽过滤条件
      if (line.includes('\t')) {
        return trimmed.length > 0 && !isJavaScriptCode(trimmed);
      }
      // 过滤掉空行、单个符号、或看起来像代码的行
      return trimmed.length > 1 && 
             !isJavaScriptCode(trimmed) &&
             !/^[{}()\[\];,]+$/.test(trimmed);  // 过滤只包含符号的行
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');  // 再次清理多余换行
  
  console.log("=== 清洗后的HTML ===");
  console.log(result);
  console.log("=== 清洗后的HTML 结束 ===");
  
  return result;
}

document.addEventListener('DOMContentLoaded', () => {
  const selectionContainer = document.getElementById('selection-container');
  const presetsContainer = document.getElementById('presets-container');
  const resultContent = document.getElementById('result-content');
  const cancelButton = document.getElementById('cancel-button');
  const specialRequirements = document.getElementById('special-requirements');
  const generateButton = document.getElementById('generate-button');
  const generateStatus = document.getElementById('generate-status');
  
  // 模型选择器相关元素
  const modelSelector = document.getElementById('model-selector');
  const modelDescription = document.getElementById('model-description');
  const openSettingsLink = document.getElementById('open-settings');

  let currentSelectionHTML = '';
  let currentCleanedText = '';
  let selectedPreset = null;
  let lastFullPrompt = ''; // 保存最后发送的完整prompt
  
  // 模型描述映射
  const modelDescriptions = {
    'gpt-4.1-mini': '快速响应，适合日常任务',
    'gpt-4.1': '高质量输出，适合复杂任务',
    'gpt-4.1-nano': '轻量级模型，成本较低',
    'gemini-2.5-flash': '快速多模态模型'
  };

  // 初始化模型选择器
  initializeModelSelector();
  
  // 模型选择器变化事件
  modelSelector.addEventListener('change', (e) => {
    const selectedModel = e.target.value;
    updateModelDescription(selectedModel);
    saveCurrentModel(selectedModel);
    console.log('模型已切换到:', selectedModel);
  });
  
  // 打开设置页面
  openSettingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // 取消按钮事件监听
  cancelButton.addEventListener('click', () => {
    // 向后台发送取消消息
    chrome.runtime.sendMessage({ type: "cancel-all" });
    // 关闭popup窗口
    window.close();
  });

  // 生成按钮点击事件
  generateButton.addEventListener('click', async () => {
    if (!selectedPreset) {
      alert('请先选择一个预设 Prompt');
      return;
    }
    
    console.log("开始生成 AI 内容...");
    console.log("选中的预设:", selectedPreset);
    console.log("特殊要求:", specialRequirements.value);
    console.log("清洗后的内容长度:", currentCleanedText.length);
    
    // 构建完整的 prompt
    let fullPrompt = selectedPreset.prompt.replace('{selection}', currentCleanedText);
    
    // 添加特殊要求
    if (specialRequirements.value.trim()) {
      fullPrompt += '\n\n特殊要求：' + specialRequirements.value.trim();
    }
    
    lastFullPrompt = fullPrompt;
    console.log("完整 Prompt:", fullPrompt);
    console.log("完整 Prompt 长度:", fullPrompt.length);
    
    // 估算处理时间并显示提示
    const estimatedTime = Math.max(10, Math.min(120, fullPrompt.length / 100));
    const timeoutWarning = fullPrompt.length > 5000 ? 
      `\n⏱️ 内容较长，预计需要 ${Math.round(estimatedTime)} 秒，请耐心等待...` : '';
    
    // 更新UI状态
    generateButton.disabled = true;
    generateButton.textContent = '生成中...';
    generateButton.style.backgroundColor = '#ffc107';
    
    resultContent.innerHTML = `
      <p><strong>已选择预设:</strong> ${selectedPreset.name}</p>
      <p><strong>状态:</strong> <span style="color: #ffc107;">正在生成中...</span>${timeoutWarning}</p>
      
      <div style="margin-top: 15px;">
        <h3>📝 发送的 Prompt:</h3>
        <div style="background-color: #f0f8ff; padding: 8px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; border: 1px solid #b0d4f1; color: #2c5aa0;">${fullPrompt}</div>
      </div>
      
      <div style="margin-top: 15px;">
        <div style="background-color: #fff3cd; padding: 10px; border-radius: 4px; border: 1px solid #ffeaa7;">
          <p style="margin: 0; color: #856404; font-size: 12px;">
            🤖 正在调用 AI 模型处理内容...
            ${fullPrompt.length > 5000 ? '<br/>⚠️ 内容较长，处理时间可能需要 1-2 分钟' : ''}
            ${fullPrompt.length > 10000 ? '<br/>⚠️ 如果超时，建议减少选中内容的长度' : ''}
          </p>
        </div>
      </div>
    `;
    
    try {
      // 调用后台脚本处理 AI 请求
      const response = await chrome.runtime.sendMessage({
        type: "call-ai",
        fullPrompt: fullPrompt
      });
      
      console.log("AI 调用响应:", response);
      
      if (response.success) {
        // AI 调用成功
        resultContent.innerHTML = `
          <p><strong>已选择预设:</strong> ${selectedPreset.name}</p>
          <p><strong>状态:</strong> <span style="color: green;">生成成功</span></p>
          
          <div style="margin-top: 15px;">
            <h3>📝 发送的 Prompt:</h3>
            <div style="background-color: #f0f8ff; padding: 8px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; border: 1px solid #b0d4f1; color: #2c5aa0;">${lastFullPrompt}</div>
          </div>
          
          <div style="margin-top: 15px;">
            <h3>🤖 AI 生成结果:</h3>
            <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd;">${response.result}</div>
          </div>
          
          <div style="margin-top: 15px; text-align: center;">
            <button id="export-json" style="background-color: #007cba; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 14px; border-radius: 5px; margin-right: 10px;">📁 导出 JSON</button>
            <button id="copy-result" style="background-color: #28a745; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 14px; border-radius: 5px; margin-right: 10px;">📋 复制结果</button>
            <button id="regenerate" style="background-color: #ffc107; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 14px; border-radius: 5px;">🔄 重新生成</button>
          </div>
        `;
        
        // 添加导出按钮事件
        document.getElementById('export-json').addEventListener('click', async () => {
          const exportBtn = document.getElementById('export-json');
          const originalText = exportBtn.textContent;
          
          try {
            exportBtn.textContent = '📁 导出中...';
            exportBtn.disabled = true;
            exportBtn.style.backgroundColor = '#6c757d';
            
            await exportResultToJSON(response.result);
            
            exportBtn.textContent = '✅ 导出完成';
            exportBtn.style.backgroundColor = '#28a745';
            
            setTimeout(() => {
              exportBtn.textContent = originalText;
              exportBtn.disabled = false;
              exportBtn.style.backgroundColor = '#007cba';
            }, 3000);
            
          } catch (error) {
            console.error('导出失败:', error);
            exportBtn.textContent = '❌ 导出失败';
            exportBtn.style.backgroundColor = '#dc3545';
            
            setTimeout(() => {
              exportBtn.textContent = originalText;
              exportBtn.disabled = false;
              exportBtn.style.backgroundColor = '#007cba';
            }, 3000);
          }
        });
        
        // 添加复制结果按钮事件
        document.getElementById('copy-result').addEventListener('click', () => {
          navigator.clipboard.writeText(response.result).then(() => {
            const copyBtn = document.getElementById('copy-result');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ 已复制';
            copyBtn.style.backgroundColor = '#20c997';
            setTimeout(() => {
              copyBtn.textContent = originalText;
              copyBtn.style.backgroundColor = '#28a745';
            }, 2000);
          }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请手动复制');
          });
        });
        
        // 添加重新生成按钮事件
        document.getElementById('regenerate').addEventListener('click', () => {
          generateButton.click(); // 触发重新生成
        });
        
      } else {
        // AI 调用失败
        const errorMessage = response.error || '未知错误';
        const isTimeoutError = errorMessage.includes('超时') || errorMessage.includes('timeout');
        const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('网络');
        
        resultContent.innerHTML = `
          <p><strong>已选择预设:</strong> ${selectedPreset.name}</p>
          <p><strong>状态:</strong> <span style="color: red;">生成失败</span></p>
          
          <div style="margin-top: 15px;">
            <h3>📝 发送的 Prompt:</h3>
            <div style="background-color: #f0f8ff; padding: 8px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; border: 1px solid #b0d4f1; color: #2c5aa0;">${lastFullPrompt}</div>
          </div>
          
          <div style="margin-top: 15px; padding: 10px; background-color: #f8d7da; border-radius: 4px; border: 1px solid #f5c6cb;">
            <h3 style="margin-top: 0; color: #721c24;">❌ 错误信息</h3>
            <div style="background-color: #fff; padding: 8px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 11px; color: #721c24; border: 1px solid #f5c6cb;">${errorMessage}</div>
            
            ${isTimeoutError ? `
              <div style="margin-top: 10px; padding: 8px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                <h4 style="margin: 0 0 5px 0; color: #856404;">💡 超时解决建议：</h4>
                <ul style="margin: 5px 0; color: #856404; font-size: 11px;">
                  <li>尝试选择更小的内容区域</li>
                  <li>简化 Prompt 内容</li>
                  <li>检查网络连接稳定性</li>
                  <li>稍后重试</li>
                </ul>
              </div>
            ` : ''}
            
            ${isNetworkError ? `
              <div style="margin-top: 10px; padding: 8px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                <h4 style="margin: 0 0 5px 0; color: #856404;">🌐 网络问题解决建议：</h4>
                <ul style="margin: 5px 0; color: #856404; font-size: 11px;">
                  <li>检查网络连接</li>
                  <li>确认 API Key 是否正确</li>
                  <li>检查防火墙设置</li>
                  <li>如使用 OpenAI，可能需要科学上网</li>
                </ul>
              </div>
            ` : ''}
          </div>
          
          <div style="margin-top: 10px; text-align: center;">
            <button id="retry" style="background-color: #dc3545; color: white; border: none; padding: 8px 16px; cursor: pointer; font-size: 12px; border-radius: 3px;">🔄 重试</button>
          </div>
        `;
        
        // 添加重试按钮事件
        document.getElementById('retry').addEventListener('click', () => {
          generateButton.click(); // 触发重试
        });
      }
      
    } catch (error) {
      console.error("调用 AI 时发生错误:", error);
      
      resultContent.innerHTML = `
        <p><strong>状态:</strong> <span style="color: red;">调用失败</span></p>
        <div style="margin-top: 15px; padding: 10px; background-color: #f8d7da; border-radius: 4px; border: 1px solid #f5c6cb;">
          <h3 style="margin-top: 0; color: #721c24;">❌ 系统错误</h3>
          <p style="margin: 5px 0; color: #721c24; font-size: 12px;">插件内部错误: ${error.message}</p>
          <p style="margin: 5px 0; color: #721c24; font-size: 11px;">请尝试刷新页面后重试，或检查浏览器控制台获取更多信息。</p>
        </div>
        
        <div style="margin-top: 10px; text-align: center;">
          <button id="retry-system" style="background-color: #dc3545; color: white; border: none; padding: 8px 16px; cursor: pointer; font-size: 12px; border-radius: 3px;">🔄 重试</button>
        </div>
      `;
      
      // 添加重试按钮事件
      document.getElementById('retry-system').addEventListener('click', () => {
        generateButton.click(); // 触发重试
      });
    } finally {
      // 恢复按钮状态
      generateButton.disabled = false;
      generateButton.textContent = '🚀 生成';
      generateButton.style.backgroundColor = '#28a745';
    }
  });

  // 1. 从 storage 加载捕获的内容和预设
  chrome.storage.local.get('lastSelectionHTML', (localData) => {
    console.log("=== 加载本地数据 ===");
    console.log("本地存储数据:", localData);
    
    if (localData.lastSelectionHTML) {
      currentSelectionHTML = localData.lastSelectionHTML;
      console.log("原始HTML长度:", currentSelectionHTML.length);
      console.log("原始HTML内容（前200字符）:", currentSelectionHTML.substring(0, 200));
      
      // 清洗HTML内容
      currentCleanedText = cleanHTML(currentSelectionHTML);
      console.log("清洗后内容长度:", currentCleanedText.length);
      console.log("清洗后内容（前200字符）:", currentCleanedText.substring(0, 200));
      
      // 显示清洗后的文本内容
      selectionContainer.textContent = currentCleanedText;
    } else {
      console.log("没有找到本地存储的HTML内容");
      selectionContainer.textContent = '没有捕获到任何内容。请先在页面上点击插件图标，然后选择一个元素。';
    }
  });

  chrome.storage.sync.get('presets', (syncData) => {
    console.log("=== 加载预设数据 ===");
    console.log("同步存储数据:", syncData);
    
    presetsContainer.innerHTML = ''; // 清空加载提示
    const presets = syncData.presets || [];
    console.log("预设数量:", presets.length);
    console.log("预设列表:", presets);
    
    if (presets.length > 0) {
      presets.forEach((preset, index) => {
        console.log(`预设 ${index}:`, preset);
        const button = document.createElement('button');
        button.textContent = preset.name;
        button.addEventListener('click', () => {
          selectPreset(preset, button);
        });
        presetsContainer.appendChild(button);
      });
    } else {
      presetsContainer.innerHTML = '<p>没有找到预设。请前往<a href="#" id="options-link">设置页面</a>添加。</p>';
    }
  });

  // 2. 处理预设按钮的点击（只选择，不调用AI）
  function selectPreset(preset, buttonElement) {
    console.log("=== 选择预设 ===");
    console.log("选择的预设:", preset);
    console.log("预设名称:", preset.name);
    console.log("预设Prompt:", preset.prompt);
    
    // 移除其他按钮的选中状态
    const allButtons = presetsContainer.querySelectorAll('button');
    allButtons.forEach(btn => {
      btn.style.backgroundColor = '#fff';
      btn.style.color = '#000';
    });

    // 设置当前按钮为选中状态
    buttonElement.style.backgroundColor = '#007cba';
    buttonElement.style.color = '#fff';

    // 保存选中的预设
    selectedPreset = preset;
    console.log("已保存选中的预设:", selectedPreset);

    // 启用生成按钮
    if (currentCleanedText) {
      generateButton.disabled = false;
      generateStatus.textContent = '点击"生成"按钮开始AI处理';
      console.log("生成按钮已启用");
    } else {
      console.log("警告：没有清洗后的内容，生成按钮保持禁用");
    }

    // 显示预设信息
    resultContent.innerHTML = `
      <p><strong>已选择预设:</strong> ${preset.name}</p>
      <p><strong>预设内容:</strong> ${preset.prompt}</p>
      <p><i>点击"生成"按钮开始处理...</i></p>
    `;
  }

  // 使设置页面的链接可以工作
  document.body.addEventListener('click', event => {
      if (event.target.id === 'options-link') {
          chrome.runtime.openOptionsPage();
          event.preventDefault();
      }
  })

  // 导出结果到JSON文件
  async function exportResultToJSON(aiResult) {
    try {
      console.log("开始导出JSON数据...");
      
      // 获取当前标签页信息
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const currentTab = tabs[0];
      
      // 获取页面截图
      const screenshot = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
      
      // 获取完整页面HTML
      let pageHTML = "无法获取完整HTML";
      try {
        pageHTML = await chrome.tabs.sendMessage(currentTab.id, {type: "get-page-html"});
      } catch (error) {
        console.warn("获取页面HTML失败:", error);
      }
      
              // 获取AI模型设置
        const settings = await new Promise((resolve) => {
          chrome.storage.sync.get([
            'openaiApiKey', 
            'modelName', 
            'temperature', 
            'maxTokens'
          ], (data) => {
            resolve(data);
          });
        });
      
      // 构建导出数据
      const exportData = {
        metadata: {
          exportTime: new Date().toISOString(),
          exportTimestamp: Date.now(),
          version: "1.2.0",
          pluginName: "Web 摘录助手",
          userAgent: navigator.userAgent
        },
        pageInfo: {
          url: currentTab.url,
          title: currentTab.title,
          domain: new URL(currentTab.url).hostname,
          fullHTML: pageHTML,
          htmlLength: pageHTML.length,
          screenshot: screenshot,
          screenshotSize: screenshot.length
        },
        selection: {
          originalHTML: currentSelectionHTML,
          cleanedText: currentCleanedText,
          textLength: currentCleanedText.length,
          htmlLength: currentSelectionHTML.length,
          compressionRatio: Math.round((1 - currentCleanedText.length / currentSelectionHTML.length) * 100)
        },
        prompt: {
          presetName: selectedPreset.name,
          presetPrompt: selectedPreset.prompt,
          specialRequirements: specialRequirements.value.trim(),
          fullPrompt: lastFullPrompt,
          promptLength: lastFullPrompt.length,
          hasSpecialRequirements: specialRequirements.value.trim().length > 0
        },
        aiResponse: {
          result: aiResult,
          resultLength: aiResult.length,
          requestParameters: {
            model: await getCurrentModel(),
            maxTokens: settings.maxTokens || 16384,
            temperature: settings.temperature || 0.7,
            apiProvider: 'OpenAI'
          },
          processingTime: new Date().toISOString()
        },
        statistics: {
          totalProcessingTime: new Date().toISOString(),
          contentReduction: Math.round((1 - currentCleanedText.length / currentSelectionHTML.length) * 100) + "%",
          promptToResponseRatio: Math.round(aiResult.length / lastFullPrompt.length * 100) / 100,
          dataSize: {
            originalHTML: currentSelectionHTML.length,
            cleanedText: currentCleanedText.length,
            prompt: lastFullPrompt.length,
            response: aiResult.length,
            screenshot: screenshot.length,
            fullHTML: pageHTML.length
          }
        }
      };
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const domain = new URL(currentTab.url).hostname.replace(/[^a-zA-Z0-9]/g, '-');
      const filename = `web-extract-${domain}-${timestamp}.json`;
      
      // 下载JSON文件
      downloadJSON(exportData, filename);
      
      console.log("JSON导出完成:", filename);
      console.log("导出数据统计:", exportData.statistics);
      
    } catch (error) {
      console.error("导出JSON失败:", error);
      throw error; // 重新抛出错误，让调用者处理
    }
  }
  
  // 下载JSON文件
  function downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("JSON文件已下载:", filename);
  }
  
  // 初始化模型选择器
  function initializeModelSelector() {
    // 从存储中加载当前模型设置
    chrome.storage.sync.get(['modelName'], (data) => {
      const currentModel = data.modelName || 'gpt-4.1-mini';
      modelSelector.value = currentModel;
      updateModelDescription(currentModel);
    });
  }
  
  // 更新模型描述
  function updateModelDescription(modelName) {
    const description = modelDescriptions[modelName] || '未知模型';
    modelDescription.textContent = description;
  }
  
  // 保存当前选择的模型（临时保存，不影响设置页面的配置）
  function saveCurrentModel(modelName) {
    // 使用 local storage 临时保存，这样不会影响设置页面的配置
    chrome.storage.local.set({ 'tempModelName': modelName });
  }
  
  // 获取当前选择的模型（优先使用临时选择，然后是设置页面的配置）
  function getCurrentModel() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tempModelName'], (localData) => {
        if (localData.tempModelName) {
          resolve(localData.tempModelName);
        } else {
          chrome.storage.sync.get(['modelName'], (syncData) => {
            resolve(syncData.modelName || 'gpt-4.1-mini');
          });
        }
      });
    });
  }
});
