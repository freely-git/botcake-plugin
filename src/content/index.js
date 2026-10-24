(function() {
  const targetParam = 'self_page_botcake_extension';
  const searchParams = new URL(window.location.href).searchParams;
  if (!searchParams.has(targetParam)) return;

  window.stop();

  // 构建干净的宿主环境。不把凭据放入 DOM，避免被页面脚本读取。
  document.documentElement.innerHTML = `
    <head><meta charset="UTF-8"><title>Botcake 看板</title></head>
    <body style="margin:0;"><div id="app"></div></body>
  `;

  // 只注入应用所需的固定资源。
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('assets/popup.js');
  script.type = 'module';

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('assets/popup.css');

  document.head.appendChild(link);
  document.body.appendChild(script);
})();
