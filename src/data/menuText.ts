import type { MenuText } from "./types.ts";

// The menus' and pages' text. A {name} is filled in by the game, and src/home/menuText.ts
// lists the names each line may use.
export const MENU_TEXT = {
  celebration: {
    button: "Nice!",
    titleMany: "{count} badges earned!",
    titleOne: "Badge earned!",
  },
  crash: {
    body: "Your saved progress is kept.",
    reload: "Reload",
    title: "Something went wrong",
  },
  end: {
    earnings: {
      cardCosts: "Card costs",
      cashLost: "Cash lost",
      fees: "Pay",
      fullPack: "Walk bonus",
      luckyFinds: "Lucky finds",
      start: "Start cash",
      tips: "Tips",
    },
    firedYou: "{owner} fired you!",
    headHome: "Back to title",
    newBest: "New best!",
    titles: {
      finished: "What a walk!",
      noDogs: "Out of dogs for today",
      wentHome: "Home sweet home",
    },
    total: "Total",
    zonesWalked: "Route",
  },
  help: {
    gotIt: "Got it",
    heading: "How to walk",
    next: "Next",
    previous: "Previous",
  },
  pause: {
    headHome: "End walk",
    help: "Help",
    note: "Ending now keeps {kept} of {cash}.",
    noteAll: "Ending now keeps all {cash}.",
    resume: "Resume",
    settings: "Settings",
    title: "Paused",
  },
  settings: {
    effects: "Effects",
    install: "Install",
    installButton: "Install",
    installNote: "Full screen, offline",
    installSteps: {
      chromiumAndroid: {
        steps: "Tap the menu, then Add to Home screen or Install app.",
        title: "Install app",
      },
      chromiumDesktop: {
        steps: "Choose Install in the address bar or the browser menu.",
        title: "Install app",
      },
      firefoxAndroid: {
        steps: "Tap the menu, then More, then Add app to Home screen.",
        title: "Add app to Home screen",
      },
      firefoxDesktop: {
        steps: "Firefox can't install this game. Open it in Chrome or Edge to install.",
        title: "Not available in Firefox",
      },
      ios: { steps: "Tap Share, then Add to Home Screen.", title: "Add to Home Screen" },
      other: {
        steps: "Use your browser's menu to install it or add it to your home screen.",
        title: "Install",
      },
      safariMac: { steps: "Choose File, then Add to Dock.", title: "Add to Dock" },
      samsungInternet: {
        steps: "Tap the menu, then Add page to, then Home screen.",
        title: "Add to Home screen",
      },
    },
    motion: "Reduced motion",
    motionNote: "Skips shakes, bobs, confetti, scenery",
    music: "Music",
    muted: "Muted",
    sound: "Sound",
    soundNote: "Mutes music and effects",
    title: "Settings",
    volume: "{percent}%",
  },
  stats: {
    badgeDifficulty: { easy: "Easy", hard: "Hard", medium: "Medium" },
    badgeEarned: "Earned",
    badgeLine: '"{line}"',
    badgeLocked: "Locked",
    badgeProgress: "{have}/{need}",
    dogColumns: {
      fired: "Fired",
      walks: "Walks",
      zones: "Neighbourhoods",
    },
    earnedCount: "{earned}/{total} earned",
    outcomes: {
      finished: "Finished",
      noDogs: "Out of dogs",
      wentHome: "Headed home",
    },
    overall: {
      bestRun: "Most earned in one walk",
      bestRunDogs: "That walk's dogs",
      bestRunZones: "That walk's neighbourhoods",
      bestZone: "Most neighbourhoods in one walk",
      dogsWalked: "Dogs walked",
      lifetime: "Lifetime earnings",
      runsPlayed: "Walks started",
      timesFired: "Times fired",
    },
    sections: {
      overall: "Overall",
      runs: "How walks ended",
    },
    tabs: {
      badges: "Badges",
      dogs: "Dogs",
      runs: "Walks",
    },
    timesFiredBy: "{count} (most: {owner})",
    title: "Logbook",
  },
} as const satisfies MenuText;
