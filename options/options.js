// options/options.js

// -- 事件监听 --
document.addEventListener('DOMContentLoaded', function() {
  // 加载保存的设置
  loadSettings();
  
  // 加载预设列表
  loadPresets();
  
  // 保存设置按钮事件
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // 添加预设按钮事件
  document.getElementById('add-preset').addEventListener('click', addPreset);
  
  // 温度滑块实时更新
  document.getElementById('temperature').addEventListener('input', function(e) {
    document.getElementById('temperature-value').textContent = e.target.value;
  });
  
  // 键盘快捷键
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      saveSettings();
    } else if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      // Enter键移动到下一个输入框
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      const currentIndex = inputs.indexOf(e.target);
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }
  });
});

// 加载设置
function loadSettings() {
  chrome.storage.sync.get([
    'openaiApiKey', 
    'modelName', 
    'temperature', 
    'maxTokens'
  ], function(data) {
    if (data.openaiApiKey) {
      document.getElementById('openai-api-key').value = data.openaiApiKey;
    }
    
    if (data.modelName) {
      document.getElementById('model-name').value = data.modelName;
    } else {
      document.getElementById('model-name').value = 'gpt-4.1-mini'; // 默认值
    }
    
    if (data.temperature !== undefined) {
      document.getElementById('temperature').value = data.temperature;
      document.getElementById('temperature-value').textContent = data.temperature;
    } else {
      document.getElementById('temperature').value = 0.7; // 默认值
      document.getElementById('temperature-value').textContent = '0.7';
    }
    
    if (data.maxTokens) {
      document.getElementById('max-tokens').value = data.maxTokens;
    } else {
      document.getElementById('max-tokens').value = 16384; // 默认值
    }
  });
}

// 保存设置
function saveSettings() {
  const openaiApiKey = document.getElementById('openai-api-key').value.trim();
  const modelName = document.getElementById('model-name').value;
  const temperature = parseFloat(document.getElementById('temperature').value);
  const maxTokens = parseInt(document.getElementById('max-tokens').value);
  
  if (!openaiApiKey) {
    alert('请输入 OpenAI API Key');
    return;
  }
  
  // 验证API Key格式
  if (!openaiApiKey.startsWith('sk-')) {
    if (!confirm('API Key 格式可能不正确（通常以 sk- 开头），确定要保存吗？')) {
      return;
    }
  }
  
  // 验证参数范围
  if (temperature < 0 || temperature > 2) {
    alert('温度值必须在 0-2 之间');
    return;
  }
  
  if (maxTokens < 100 || maxTokens > 32000) {
    alert('最大令牌数必须在 100-32000 之间');
    return;
  }
  
  chrome.storage.sync.set({
    openaiApiKey: openaiApiKey,
    modelName: modelName,
    temperature: temperature,
    maxTokens: maxTokens
  }, function() {
    // 显示保存成功提示
    const saveBtn = document.getElementById('save-settings');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✅ 保存成功';
    saveBtn.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '#007cba';
    }, 2000);
    
    console.log('设置已保存:', {
      modelName: modelName,
      temperature: temperature,
      maxTokens: maxTokens
    });
  });
}

// 加载预设列表
function loadPresets() {
  chrome.storage.sync.get({ presets: [] }, (data) => {
    renderPresets(data.presets);
  });
}

// 渲染预设列表
function renderPresets(presets) {
  const presetList = document.getElementById('preset-list');
  presetList.innerHTML = ''; // 清空旧列表

  if (!presets || presets.length === 0) {
    presetList.innerHTML = '<p style="color: #666; font-style: italic;">还没有预设 Prompt。请在下方添加一个。</p>';
    return;
  }

  presets.forEach((preset, index) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.style.cssText = 'background: #f0f0f0; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #007cba;';
    item.innerHTML = `
      <p><strong>📋 ${preset.name}</strong></p>
      <div style="white-space: pre-wrap; background: #fff; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; margin: 8px 0; border: 1px solid #ddd; max-height: 150px; overflow-y: auto;">${preset.prompt}</div>
      <button data-index="${index}" class="delete-preset" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 12px;">🗑️ 删除</button>
    `;
    presetList.appendChild(item);
  });
}

// 添加新的预设
function addPreset() {
  const nameInput = document.getElementById('preset-name');
  const promptInput = document.getElementById('preset-prompt');
  const name = nameInput.value.trim();
  const prompt = promptInput.value.trim();

  if (!name || !prompt) {
    const status = document.getElementById('preset-status');
    status.textContent = '❌ 预设名称和 Prompt 内容都不能为空！';
    status.style.color = 'red';
    setTimeout(() => status.textContent = '', 3000);
    return;
  }

  // 检查是否包含 {selection} 占位符
  if (!prompt.includes('{selection}')) {
    const confirmAdd = confirm('您的 Prompt 中没有包含 {selection} 占位符，这意味着选中的内容不会被传递给 AI。\n\n是否仍要添加此预设？');
    if (!confirmAdd) {
      return;
    }
  }

  chrome.storage.sync.get({ presets: [] }, (data) => {
    const presets = data.presets;
    
    // 检查是否已存在同名预设
    const existingIndex = presets.findIndex(p => p.name === name);
    if (existingIndex !== -1) {
      const confirmReplace = confirm(`已存在名为"${name}"的预设，是否要替换它？`);
      if (confirmReplace) {
        presets[existingIndex] = { name, prompt };
      } else {
        return;
      }
    } else {
      presets.push({ name, prompt });
    }
    
    chrome.storage.sync.set({ presets }, () => {
      const status = document.getElementById('preset-status');
      status.textContent = '✅ 预设已添加！';
      status.style.color = 'green';
      nameInput.value = ''; // 清空输入框
      promptInput.value = '';
      renderPresets(presets); // 重新渲染列表
      setTimeout(() => status.textContent = '', 2000);
    });
  });
}

// 删除预设
function deletePreset(event) {
  const index = parseInt(event.target.dataset.index, 10);
  chrome.storage.sync.get({ presets: [] }, (data) => {
    const presets = data.presets;
    const presetName = presets[index]?.name || '未知预设';
    
    const confirmDelete = confirm(`确定要删除预设"${presetName}"吗？`);
    if (!confirmDelete) {
      return;
    }
    
    presets.splice(index, 1); // 从数组中删除
    chrome.storage.sync.set({ presets }, () => {
      renderPresets(presets); // 重新渲染列表
      
      // 显示删除成功消息
      const status = document.getElementById('preset-status');
      status.textContent = `✅ 已删除预设"${presetName}"`;
      status.style.color = 'green';
      setTimeout(() => status.textContent = '', 2000);
    });
  });
}

// 为删除按钮设置事件委托
document.addEventListener('click', (event) => {
  if (event.target && event.target.classList.contains('delete-preset')) {
    deletePreset(event);
  }
});

// 添加键盘快捷键支持
document.addEventListener('keypress', (event) => {
  if (event.target.id === 'preset-name' && event.key === 'Enter') {
    document.getElementById('preset-prompt').focus();
  }
  
  if (event.target.id === 'preset-prompt' && event.key === 'Enter' && event.ctrlKey) {
    addPreset();
  }
}); 