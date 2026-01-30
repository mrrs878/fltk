/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-28 19:45:52
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-28 20:03:05
 */

// 由于浏览器直接导入ES模块有限制，这里使用动态导入方式
async function initSolidApp() {
  // 动态导入 Solid.js 模块
  const solidModule = await import('https://cdn.skypack.dev/pin/solid-js@v1.9.0-GyuM46oDHQJcjEUN9qnm/solid-js.js');
  const solidWebModule = await import('https://cdn.skypack.dev/pin/solid-js@v1.9.0-GyuM46oDHQJcjEUN9qnm/web/dist/web.js');

  const { createSignal } = solidModule;
  const { render } = solidWebModule;

  // 创建一个简单的 Solid 组件
  function App() {
    const [count, setCount] = createSignal(0);
    
    // 创建一个容器元素
    const container = document.createElement('div');
    container.style = "font-family: sans-serif; padding: 2rem;";
    
    // 创建标题
    const h1 = document.createElement('h1');
    h1.textContent = "Welcome to QuickADB with Solid.js";
    h1.style.color = "#2ecc71";
    
    // 创建计数显示元素
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    p.appendChild(document.createTextNode("Current count: "));
    p.appendChild(strong);
    
    // 创建按钮
    const button = document.createElement('button');
    button.textContent = "Increment";
    
    // 创建额外的换行
    const br1 = document.createElement('br');
    const br2 = document.createElement('br');
    
    // 创建原始文本段落
    const originalText = document.createElement('p');
    originalText.textContent = "Original: Hello, QuickADB!";
    originalText.style.color = "#f00";
    
    // 将元素添加到容器
    container.appendChild(h1);
    container.appendChild(p);
    container.appendChild(button);
    container.appendChild(br1);
    container.appendChild(br2);
    container.appendChild(originalText);
    
    // 响应式更新计数值
    solidModule.createEffect(() => {
      strong.textContent = count();
    });
    
    // 添加按钮点击事件
    button.addEventListener('click', () => {
      setCount(count() + 1);
    });
    
    return container;
  }

  // 渲染应用到目标元素
  render(() => App(), document.getElementById('solid-app'));
}

// 页面加载完成后初始化应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSolidApp);
} else {
  initSolidApp();
}