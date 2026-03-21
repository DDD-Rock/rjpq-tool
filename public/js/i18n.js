/**
 * i18n - 简体中文 / 繁体中文 自动切换
 * 通过 navigator.language 检测设备语言，繁体地区自动切换。
 */
const I18N = {
  'zh-CN': {
    // 页面标题 & 描述
    title_home: 'YzY - 冒险岛跳台协作工具',
    title_room: 'YzY - 房间',
    desc_home: '罗朱PQ跳台协作工具 — 创建房间，实时标记，轻松通关。YzY公会出品',
    desc_room: '点击链接加入房间，实时协作标记平台路径。YzY公会出品',

    // 首页
    heading: '冒险岛 · 罗朱跳台协作工具',
    subtitle: '冒险岛世界Artale - YzY公会',
    online_prefix: '🌐 在线: ',
    online_suffix: ' 人',
    refresh_title: '刷新在线人数',
    pwd_placeholder: '自定义密码（留空自动生成）',
    create_room: '创建房间',
    creating: '创建中...',
    or_join: '或加入已有房间',
    code_placeholder: '输入6位房间代码',
    pwd_join_placeholder: '房间密码',
    join_room: '加入房间',
    how_to_use: '使用方法',
    step1: '一人创建房间，将链接分享给队友',
    step2: '队友输入房间代码和密码加入',
    step3: '每人选择自己的角色（101-104）',
    step4: '找到正确平台后点击对应方块标记',
    step5: '路径实时同步，全队共享',
    create_fail: '创建房间失败，请检查网络后重试',
    input_code: '请输入6位数字房间代码',
    input_pwd: '请输入房间密码',

    // 房间页
    room_label: '房间',
    pwd_label: '密码',
    back_title: '返回首页',
    copy_title: '复制房间信息',
    room_count_title: '房间内人数',
    my_path: '我的路径',
    reset: '重置',
    invalid_code: '无效的房间代码',
    select_char: '请先选择角色（101-104）',
    confirm_reset: '确定清空所有标记？',
    copy_text: '房间: {code}  密码: {pwd}',
    err_pwd: '密码错误',
    err_not_found: '房间不存在',
  },
  'zh-TW': {
    title_home: 'YzY - Artale跳台協作工具',
    title_room: 'YzY - 房間',
    desc_home: '羅朱PQ跳台協作工具 — 建立房間，即時標記，輕鬆過關。YzY公會出品',
    desc_room: '點擊連結加入房間，即時協作標記平台路徑。YzY公會出品',

    heading: 'Artale · 羅朱跳台協作工具',
    subtitle: 'Artale - YzY公會',
    online_prefix: '🌐 線上: ',
    online_suffix: ' 人',
    refresh_title: '重新整理線上人數',
    pwd_placeholder: '自訂密碼（留空自動產生）',
    create_room: '建立房間',
    creating: '建立中...',
    or_join: '或加入已有房間',
    code_placeholder: '輸入6位房間代碼',
    pwd_join_placeholder: '房間密碼',
    join_room: '加入房間',
    how_to_use: '使用方法',
    step1: '一人建立房間，將連結分享給隊友',
    step2: '隊友輸入房間代碼和密碼加入',
    step3: '每人選擇自己的角色（101-104）',
    step4: '找到正確平台後點擊對應方塊標記',
    step5: '路徑即時同步，全隊共享',
    create_fail: '建立房間失敗，請檢查網路後重試',
    input_code: '請輸入6位數字房間代碼',
    input_pwd: '請輸入房間密碼',

    room_label: '房間',
    pwd_label: '密碼',
    back_title: '返回首頁',
    copy_title: '複製房間資訊',
    room_count_title: '房間內人數',
    my_path: '我的路徑',
    reset: '重置',
    invalid_code: '無效的房間代碼',
    select_char: '請先選擇角色（101-104）',
    confirm_reset: '確定清空所有標記？',
    copy_text: '房間: {code}  密碼: {pwd}',
    err_pwd: '密碼錯誤',
    err_not_found: '房間不存在',
  }
};

// 检测语言：zh-TW, zh-HK, zh-Hant 视为繁体，其余视为简体
const userLang = navigator.language || navigator.userLanguage || 'zh-CN';
const isTW = /zh-(TW|HK|Hant)/i.test(userLang);
const currentLang = isTW ? 'zh-TW' : 'zh-CN';
const dict = I18N[currentLang];

/**
 * 获取翻译文案
 * @param {string} key 翻译 key
 * @param {Object} [params] 可选替换参数，如 { code: '123456', pwd: '1234' }
 * @returns {string}
 */
function t(key, params) {
  let text = dict[key] || I18N['zh-CN'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace('{' + k + '}', v);
    }
  }
  return text;
}

/**
 * 自动翻译页面中带 data-i18n 属性的元素
 * - data-i18n="key"           → textContent
 * - data-i18n-placeholder="key" → placeholder
 * - data-i18n-title="key"     → title
 * - data-i18n-html="key"      → innerHTML
 */
function applyI18n() {
  // 更新页面标题
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  // 更新 document.title
  const titleKey = document.documentElement.dataset.i18nTitle;
  if (titleKey) document.title = t(titleKey);

  // 更新 meta description
  const descKey = document.documentElement.dataset.i18nDesc;
  if (descKey) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t(descKey);
  }

  // 更新 html lang
  document.documentElement.lang = currentLang;
}
