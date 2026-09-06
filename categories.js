// ডিফল্ট ক্যাটাগরি ও সাব-টাস্ক ডেফিনিশন (২৪ ঘণ্টার পূর্ণাঙ্গ লাইফ ট্র্যাকিং)
const DEFAULT_CATEGORIES = [
  {
    id: 'shop',
    name: 'দোকান',
    icon: '🏪',
    color: '#3b82f6', // blue
    subcategories: [
      { id: 'mutation_app', name: 'মিউটেশন নামজারি', icon: '📝', type: 'deep_work' },
      { id: 'ldtax', name: 'ভূমি উন্নয়ন কর', icon: '🌾', type: 'deep_work' },
      { id: 'dcr_fee_pay', name: 'ডিসিআর ফি প্রদান', icon: '💳', type: 'work' },
      { id: 'khajna_online', name: 'অনলাইন খাজনা / দাখিলা', icon: '🌐', type: 'shallow_work' },
      { id: 'deed_drafting', name: 'দলিল / মিসকেস ড্রাফটিং', icon: '📜', type: 'deep_work' },
      { id: 'client_deal', name: 'কাস্টমার ডিল ও পরামর্শ', icon: '👥', type: 'communication' },
      { id: 'photocopy_online', name: 'ফটোকপি ও অনলাইন সার্ভিস', icon: '🖨️', type: 'shallow_work' },
      { id: 'accounts_cash', name: 'হিসাব-নিকাশ ও ক্যাশ মেলানো', icon: '💰', type: 'admin' },
      { id: 'shop_maintenance', name: 'দোকান খোলা ও গোছানো', icon: '🧹', type: 'routine' },
      { id: 'shop_closing', name: 'দোকান গোছানো ও দোকান বন্ধ', icon: '🔒', type: 'routine' }
    ]
  },
  {
    id: 'namaz',
    name: 'নামাজ',
    icon: '🕌',
    color: '#0d9488', // teal
    subcategories: [
      { id: 'namaz_fajr', name: 'ফজর', icon: '🌅', type: 'prayer' },
      { id: 'namaz_dhuhr', name: 'জোহর', icon: '☀️', type: 'prayer' },
      { id: 'namaz_asr', name: 'আসর', icon: '🌤️', type: 'prayer' },
      { id: 'namaz_maghrib', name: 'মাগরিব', icon: '🌇', type: 'prayer' },
      { id: 'namaz_isha', name: 'এশা', icon: '🌙', type: 'prayer' },
      { id: 'quran_study', name: 'কুরআন ও দোয়া', icon: '📖', type: 'prayer' }
    ]
  },
  {
    id: 'food',
    name: 'খাবার',
    icon: '🍛',
    color: '#f97316', // orange
    subcategories: [
      { id: 'breakfast', name: 'সকালের নাস্তা', icon: '🍳', type: 'routine' },
      { id: 'lunch', name: 'দুপুরের খাবার', icon: '🍛', type: 'routine' },
      { id: 'dinner', name: 'রাতের খাবার', icon: '🍲', type: 'routine' },
      { id: 'tea_snacks', name: 'চা ও হালকা স্ন্যাক্স', icon: '☕', type: 'routine' }
    ]
  },
  {
    id: 'parenting',
    name: 'বাচ্চা',
    icon: '👶',
    color: '#ec4899', // pink
    subcategories: [
      { id: 'school_commute', name: 'স্কুলে নেওয়া ও নিয়ে আসা', icon: '🎒', type: 'parenting' },
      { id: 'teaching_child', name: 'বাচ্চার পড়াশোনা ও হোমওয়ার্ক', icon: '📚', type: 'parenting' },
      { id: 'playing_child', name: 'বাচ্চার সাথে খেলাধুলা', icon: '⚽', type: 'parenting' },
      { id: 'child_outing', name: 'বাইরে ঘুরতে নিয়ে যাওয়া', icon: '🚶‍♂️', type: 'parenting' },
      { id: 'child_care', name: 'বাচ্চার যত্ন ও খাওয়ানো', icon: '🍼', type: 'parenting' }
    ]
  },
  {
    id: 'screen',
    name: 'মোবাইল',
    icon: '📱',
    color: '#8b5cf6', // purple
    subcategories: [
      { id: 'yt_scroll', name: 'ইউটিউব ভিডিও ও শর্টস', icon: '▶️', type: 'screentime' },
      { id: 'fb_social', name: 'ফেসবুক ও সোশ্যাল মিডিয়া', icon: '📲', type: 'screentime' },
      { id: 'web_browse', name: 'ওয়েব ব্রাউজিং ও সার্চ', icon: '🌐', type: 'screentime' },
      { id: 'other_apps', name: 'অন্যান্য অ্যাপস ও বিনোদন', icon: '🎮', type: 'screentime' }
    ]
  },
  {
    id: 'sleep',
    name: 'ঘুম',
    icon: '😴',
    color: '#6366f1', // indigo
    subcategories: [
      { id: 'night_sleep', name: 'রাতের ঘুম', icon: '🛌', type: 'rest' },
      { id: 'power_nap', name: '২৬ মিনিটের পাওয়ার ন্যাপ', icon: '😴', type: 'rest' },
      { id: 'relax_mind', name: 'বিশ্রাম ও রিল্যাক্সেশন', icon: '🧘', type: 'rest' }
    ]
  },
  {
    id: 'home',
    name: 'বাসা',
    icon: '🏠',
    color: '#10b981', // emerald
    subcategories: [
      { id: 'washroom_bath', name: 'ওয়াশরুম ও গোসল', icon: '🚿', type: 'routine' },
      { id: 'ai_learning', name: 'এআই লার্নিং ও অ্যাসাইনমেন্ট', icon: '💻', type: 'deep_work' },
      { id: 'night_reading', name: 'বই পড়া ও স্টাডি', icon: '📖', type: 'deep_work' },
      { id: 'family_relax', name: 'ফ্যামিলি টাইম ও গল্প', icon: '👨‍👩‍👧', type: 'leisure' },
      { id: 'home_chores', name: 'ঘরের টুকিটাকি কাজ', icon: '🧺', type: 'routine' }
    ]
  },
  {
    id: 'transit',
    name: 'যাতায়াত',
    icon: '🚗',
    color: '#eab308', // amber
    subcategories: [
      { id: 'commute_shop', name: 'দোকানে যাওয়া / বাড়ি ফেরা', icon: '🛵', type: 'routine' },
      { id: 'land_office', name: 'ভূমি অফিস ও এসি ল্যান্ড ভিজিট', icon: '🏛️', type: 'work' },
      { id: 'walking_refresh', name: 'হাঁটা ও মাইন্ড রিফ্রেশ', icon: '🚶‍♂️', type: 'health' },
      { id: 'bazaar', name: 'বাজার ও ব্যক্তিগত কাজ', icon: '🛍️', type: 'routine' }
    ]
  }
];

// ক্যাটাগরি লোড ও সেভ করার হেল্পার
function loadCategories() {
  const saved = localStorage.getItem('life_tracker_categories');
  if (saved) {
    try {
      let parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // নতুন ডিফল্ট ক্যাটাগরি ও সাব-টাস্কগুলো মার্জ করবে
        DEFAULT_CATEGORIES.forEach(defCat => {
          const existing = parsed.find(c => c.id === defCat.id);
          if (!existing) {
            parsed.push(defCat);
          } else {
            defCat.subcategories.forEach(defSub => {
              const existingSub = existing.subcategories.find(s => s.id === defSub.id || s.name === defSub.name);
              if (!existingSub) {
                // মিউটেশন নামজারি পুরনো 'মিউটেশন আবেদন' থাকলে নাম আপডেট করবে
                if (defSub.id === 'mutation_app') {
                  const oldMut = existing.subcategories.find(s => s.id === 'mutation_app' || s.name === 'মিউটেশন আবেদন');
                  if (oldMut) {
                    oldMut.name = defSub.name;
                    return;
                  }
                }
                existing.subcategories.push(defSub);
              } else if (defSub.id === 'mutation_app' && existingSub.name !== defSub.name) {
                existingSub.name = defSub.name;
              }
            });
          }
        });
        saveCategories(parsed);
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing saved categories:', e);
    }
  }
  return DEFAULT_CATEGORIES;
}

function saveCategories(categories) {
  localStorage.setItem('life_tracker_categories', JSON.stringify(categories));
}
