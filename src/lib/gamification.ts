// ─── Gamification Logic ─────────────────────────────────────────────────────

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  category?: string;
  completed: boolean;
}

export interface GamificationData {
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  bestStreak: number;
  totalExpensesLogged: number;
  totalScans: number;
  badges: string[]; // unlocked badge IDs
  monthlyScore: number; // 0-100
  challenges: Challenge[];
  activeDays: string[]; // YYYY-MM-DD array for heatmap
}

export interface BudgetData {
  income: number;
  incomes: { id: string; name: string; amount: number }[];
  savingsGoal: number;
  expenses: {
    id: string;
    amount: number;
    category: string;
    description: string;
    date: string;
    createdAt: string;
  }[];
  mode: 'particulier' | 'independant';
  invoices: {
    id: string;
    clientName: string;
    amount: number;
    date: string;
    paid: boolean;
  }[];
}

// ─── Badge definitions ──────────────────────────────────────────────────────

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: "premier-pas", icon: "👣", name: "Premier pas", description: "Première dépense ajoutée" },
  { id: "scanner-pro", icon: "📸", name: "Scanner pro", description: "Premier ticket scanné" },
  { id: "semaine-en-feu", icon: "🔥", name: "Semaine en feu", description: "7 jours de streak" },
  { id: "mois-parfait", icon: "🌟", name: "Mois parfait", description: "30 jours de streak" },
  { id: "centurion", icon: "💯", name: "Centurion", description: "100 dépenses saisies" },
  { id: "econome", icon: "🎯", name: "Économe", description: "Budget respecté sur 1 mois" },
  { id: "objectif-atteint", icon: "🏆", name: "Objectif atteint", description: "Objectif d'épargne atteint" },
  { id: "couple-budgetaire", icon: "💑", name: "Couple budgétaire", description: "2 revenus ajoutés" },
];

// ─── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mi-gamification";

function defaultData(): GamificationData {
  return {
    streak: 0,
    lastActiveDate: "",
    bestStreak: 0,
    totalExpensesLogged: 0,
    totalScans: 0,
    badges: [],
    monthlyScore: 0,
    challenges: [],
    activeDays: [],
  };
}

export function loadGamification(): GamificationData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (!data.activeDays) data.activeDays = [];
      if (!data.challenges) data.challenges = [];
      return data;
    }
  } catch {
    /* ignore */
  }
  return defaultData();
}

export function saveGamification(data: GamificationData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Core functions ─────────────────────────────────────────────────────────

export function updateStreak(data: GamificationData): GamificationData {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const updated = { ...data };

  if (updated.lastActiveDate === today) {
    // Already active today, no change
    return updated;
  }

  if (updated.lastActiveDate === yesterday) {
    // Continue streak
    updated.streak += 1;
  } else if (updated.lastActiveDate === "") {
    // First ever activity
    updated.streak = 1;
  } else {
    // Streak broken
    updated.streak = 1;
  }

  updated.lastActiveDate = today;

  if (!updated.activeDays.includes(today)) {
    updated.activeDays = [...updated.activeDays, today];
  }

  if (updated.streak > updated.bestStreak) {
    updated.bestStreak = updated.streak;
  }

  return updated;
}

export function checkBadges(data: GamificationData, budget: BudgetData): string[] {
  const newBadges: string[] = [];
  const has = (id: string) => data.badges.includes(id);

  // Premier pas
  if (!has("premier-pas") && data.totalExpensesLogged >= 1) {
    newBadges.push("premier-pas");
  }

  // Scanner pro
  if (!has("scanner-pro") && data.totalScans >= 1) {
    newBadges.push("scanner-pro");
  }

  // Semaine en feu
  if (!has("semaine-en-feu") && data.streak >= 7) {
    newBadges.push("semaine-en-feu");
  }

  // Mois parfait
  if (!has("mois-parfait") && data.streak >= 30) {
    newBadges.push("mois-parfait");
  }

  // Centurion
  if (!has("centurion") && data.totalExpensesLogged >= 100) {
    newBadges.push("centurion");
  }

  // Économe — budget respected (expenses <= income, must have both)
  const totalIncome = budget.incomes.length > 0
    ? budget.incomes.reduce((s, p) => s + p.amount, 0)
    : budget.income;
  const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
  if (!has("econome") && totalIncome > 0 && totalExpenses > 0 && totalExpenses <= totalIncome) {
    // Only count if month has some expenses
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() >= daysInMonth - 1) {
      // Near end of month
      newBadges.push("econome");
    }
  }

  // Objectif atteint
  if (!has("objectif-atteint") && budget.savingsGoal > 0) {
    const remaining = totalIncome - totalExpenses;
    if (remaining >= budget.savingsGoal) {
      newBadges.push("objectif-atteint");
    }
  }

  // Couple budgétaire
  if (!has("couple-budgetaire") && budget.incomes.length >= 2) {
    newBadges.push("couple-budgetaire");
  }

  return newBadges;
}

export function calculateMonthlyScore(data: GamificationData, budget: BudgetData): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();

  // Régularité (0-30 pts): active days this month / days elapsed
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const activeDaysThisMonth = data.activeDays.filter((d) => d.startsWith(monthPrefix)).length;
  const regularityScore = Math.round((activeDaysThisMonth / Math.max(1, currentDay)) * 30);

  // Budget (0-40 pts): expenses <= income = 40, otherwise proportional
  const totalIncome = budget.incomes.length > 0
    ? budget.incomes.reduce((s, p) => s + p.amount, 0)
    : budget.income;
  const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);

  let budgetScore = 0;
  if (totalIncome > 0) {
    if (totalExpenses <= totalIncome) {
      budgetScore = 40;
    } else {
      budgetScore = Math.max(0, Math.round(40 * (1 - (totalExpenses - totalIncome) / totalIncome)));
    }
  }

  // Épargne (0-30 pts): savings achieved / goal
  let savingsScore = 0;
  if (budget.savingsGoal > 0 && totalIncome > 0) {
    const remaining = Math.max(0, totalIncome - totalExpenses);
    savingsScore = Math.min(30, Math.round((remaining / budget.savingsGoal) * 30));
  }

  return Math.min(100, regularityScore + budgetScore + savingsScore);
}

export function getScoreBreakdown(data: GamificationData, budget: BudgetData): { regularity: number; budget: number; savings: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const activeDaysThisMonth = data.activeDays.filter((d) => d.startsWith(monthPrefix)).length;
  const regularity = Math.round((activeDaysThisMonth / Math.max(1, currentDay)) * 30);

  const totalIncome = budget.incomes.length > 0
    ? budget.incomes.reduce((s, p) => s + p.amount, 0)
    : budget.income;
  const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);

  let budgetPts = 0;
  if (totalIncome > 0) {
    if (totalExpenses <= totalIncome) {
      budgetPts = 40;
    } else {
      budgetPts = Math.max(0, Math.round(40 * (1 - (totalExpenses - totalIncome) / totalIncome)));
    }
  }

  let savings = 0;
  if (budget.savingsGoal > 0 && totalIncome > 0) {
    const remaining = Math.max(0, totalIncome - totalExpenses);
    savings = Math.min(30, Math.round((remaining / budget.savingsGoal) * 30));
  }

  return { regularity, budget: budgetPts, savings };
}

export function generateChallenges(budget: BudgetData, gamData: GamificationData): Challenge[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Challenge 1: Reduce restaurant spending
  const restaurantTotal = budget.expenses
    .filter((e) => e.category === "restaurants")
    .reduce((s, e) => s + e.amount, 0);
  // Target: current + some buffer or a reasonable default
  const restaurantTarget = Math.max(200, Math.round(restaurantTotal * 0.8 / 10) * 10 || 300);

  // Challenge 2: Save X CHF
  const savingsTarget = budget.savingsGoal > 0 ? budget.savingsGoal : 500;
  const totalIncome = budget.incomes.length > 0
    ? budget.incomes.reduce((s, p) => s + p.amount, 0)
    : budget.income;
  const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
  const currentSavings = Math.max(0, totalIncome - totalExpenses);

  // Challenge 3: Log expenses for 20 days
  const activeDaysThisMonth = gamData.activeDays.filter((d) => d.startsWith(monthPrefix)).length;

  return [
    {
      id: `challenge-restaurants-${monthPrefix}`,
      title: `Restaurants sous ${restaurantTarget} CHF`,
      description: `Limiter vos dépenses en restaurants ce mois-ci`,
      target: restaurantTarget,
      current: restaurantTotal,
      category: "restaurants",
      completed: restaurantTotal <= restaurantTarget && budget.expenses.some((e) => e.category === "restaurants"),
    },
    {
      id: `challenge-savings-${monthPrefix}`,
      title: `Épargner ${savingsTarget} CHF`,
      description: `Atteindre votre objectif d'épargne mensuel`,
      target: savingsTarget,
      current: currentSavings,
      completed: currentSavings >= savingsTarget,
    },
    {
      id: `challenge-streak-${monthPrefix}`,
      title: `Saisir 20 jours ce mois`,
      description: `Saisissez vos dépenses pendant 20 jours`,
      target: 20,
      current: activeDaysThisMonth,
      completed: activeDaysThisMonth >= 20,
    },
  ];
}

export function onExpenseAdded(gamData: GamificationData, budget: BudgetData, count: number = 1): { gamData: GamificationData; newBadges: string[] } {
  let updated = { ...gamData };
  updated.totalExpensesLogged += count;
  updated = updateStreak(updated);

  const newBadges = checkBadges(updated, budget);
  updated.badges = [...updated.badges, ...newBadges];
  updated.monthlyScore = calculateMonthlyScore(updated, budget);
  updated.challenges = generateChallenges(budget, updated);

  saveGamification(updated);
  return { gamData: updated, newBadges };
}

export function onScanCompleted(gamData: GamificationData, budget: BudgetData, expenseCount: number): { gamData: GamificationData; newBadges: string[] } {
  let updated = { ...gamData };
  updated.totalScans += 1;
  updated.totalExpensesLogged += expenseCount;
  updated = updateStreak(updated);

  const newBadges = checkBadges(updated, budget);
  updated.badges = [...updated.badges, ...newBadges];
  updated.monthlyScore = calculateMonthlyScore(updated, budget);
  updated.challenges = generateChallenges(budget, updated);

  saveGamification(updated);
  return { gamData: updated, newBadges };
}
