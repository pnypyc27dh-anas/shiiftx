// ========================================================================
// SHIIFT X — إعدادات قاعدة البيانات والبيانات المشتركة
// ========================================================================

const SUPABASE_URL = 'https://baytojjldklocifridcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheXRvampsZGtsb2NpZnJpZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTU3MzMsImV4cCI6MjEwNTM5MTczM30.tAN7Qah-3VNwatn2CwgqsyphnkQQjagnKf4pR4WiSwQ';

// إنشاء عميل Supabase الموحد
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var db = supabase; // متوافق مع كافة التسميات المستخدمة

// رقم الواتساب المعتمد لخدمة العملاء
const OFFICIAL_WHATSAPP_NUMBER = "963900000000";

// مؤشر التحميل الخاص بشعار SHIIFT X
const BRAND_LOADER_SVG = `<svg class="w-5 h-5 inline-block glyph-pulse" viewBox="210 100 125 140" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="#5CE1E6" d="M234.632 132.734L234.737 132.895L270.402 187.555L270.537 187.763L270.388 187.961L234.723 235.284L234.616 235.425H212.435L212.827 234.867L246.018 187.733L212.815 133.272L212.487 132.734H234.632ZM332.739 132.734L332.41 133.272L299.206 187.733L332.398 234.867L332.79 235.425H310.609L310.502 235.284L274.837 187.961L274.688 187.763L274.823 187.555L310.489 132.895L310.593 132.734H332.739ZM225.717 104.646C229.012 104.647 231.91 105.552 234.396 107.37C237.099 109.098 238.429 111.887 238.429 115.655C238.429 119.302 237.094 122.079 234.406 123.931L234.406 123.932C231.918 125.755 229.017 126.664 225.717 126.664C222.102 126.664 219.037 125.76 216.542 123.932C214.011 122.077 212.763 119.296 212.763 115.655C212.763 111.893 214.007 109.103 216.552 107.371C219.045 105.548 222.107 104.646 225.717 104.646ZM319.508 104.646C323.118 104.646 326.181 105.548 328.673 107.371L328.907 107.537C331.294 109.279 332.462 112.011 332.462 115.655C332.462 119.296 331.214 122.077 328.683 123.932C326.189 125.76 323.123 126.664 319.508 126.664C316.208 126.664 313.307 125.755 310.819 123.932V123.931C308.13 122.079 306.796 119.301 306.796 115.655C306.796 111.888 308.126 109.098 310.828 107.37C313.314 105.552 316.213 104.647 319.508 104.646Z"/></svg>`;

// متغيرات عامة للمتجر
let currentUser = null;
let syncInterval = null;
let currentWalletBalance = 0.00;
let isSettingNewPassword = false;
let currentUserRole = "customer";

let rawCardNumber = "";
let lastFourDigits = "";
let isCardVisible = false;

let selectedProductId = "";
let selectedItemName = "";
let selectedItemPrice = 0.00;
let inputPlayerId = "";
let inputPlayerIdConfirm = "";
let activeCoupon = null;
let discountedPrice = 0.00;

let tempRegisterData = {};
let globalProductsRaw = [];
let currentFlowType = "register";
let globalTransactionsRaw = [];
let resendTimer = null;
