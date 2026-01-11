// FFXIV Data Centers and Worlds
export const DATA_CENTERS = {
  'Elemental': ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Ramuh', 'Tonberry', 'Typhon', 'Unicorn'],
  'Gaia': ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima', 'Valefor', 'Yojimbo', 'Zeromus'],
  'Mana': ['Anima', 'Asura', 'Belias', 'Chocobo', 'Hades', 'Ixion', 'Mandragora', 'Masamune', 'Pandaemonium', 'Shinryu', 'Titan'],
  'Meteor': ['Balmun', 'Durandal', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima', 'Valefor', 'Yojimbo', 'Zeromus'],
  'Materia': ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'],
  'Aether': ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren'],
  'Primal': ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Phoenix', 'Ultros'],
  'Crystal': ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera'],
  'Dynamis': ['Halicarnassus', 'Maduin', 'Marilith', 'Seraph'],
  'Chaos': ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Ragnarok', 'Spriggan'],
  'Light': ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'],
  'Materia': ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'],
};

export const ALL_SERVERS = Object.values(DATA_CENTERS).flat();

// Chinese servers (Simplified Chinese)
export const CHINESE_DATA_CENTERS = {
  '陆行鸟': ['红玉海', '神意之地', '拉诺西亚', '幻影群岛', '萌芽池', '宇宙和音', '沃仙曦染', '晨曦王座'],
  '莫古力': ['白银乡', '白金幻象', '神拳痕', '潮风亭', '旅人栈桥', '拂晓之间', '龙巢神殿', '梦羽宝境'],
  '猫小胖': ['紫水栈桥', '延夏', '静语庄园', '摩杜纳', '海猫茶屋', '柔风海湾', '琥珀原'],
  '豆豆柴': ['水晶塔', '银泪湖', '太阳海岸', '伊修加德', '红茶川'],
};

// Traditional Chinese servers (if different)
export const TRADITIONAL_CHINESE_DATA_CENTERS = {
  '陸行鳥': ['紅玉海', '神意之地', '拉諾西亞', '幻影群島', '萌芽池', '宇宙和音', '沃仙曦染', '晨曦王座'],
  '莫古力': ['白銀鄉', '白金幻象', '神拳痕', '潮風亭', '旅人棧橋', '拂曉之間', '龍巢神殿', '夢羽寶境'],
  '貓小胖': ['紫水棧橋', '延夏', '靜語莊園', '摩杜納', '海貓茶屋', '柔風海灣', '琥珀原'],
  '豆豆柴': ['水晶塔', '銀淚湖', '太陽海岸', '伊修加德', '紅茶川'],
};
