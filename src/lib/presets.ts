export interface DecisionPreset {
  id: string;
  label: string;
  state: string;
  question: string;
  options: string[];
}

export const PRESETS: DecisionPreset[] = [
  {
    id: "account",
    label: "Account support",
    state:
      "A customer says a password reset succeeded, but every login attempt still returns ‘account locked’. Two unlock emails were requested and neither arrived.",
    question: "Which queue should handle this request?",
    options: ["Account access support", "Billing support", "Close as resolved"],
  },
  {
    id: "email",
    label: "Email triage",
    state:
      "An email claims to be from the payroll team and says the recipient’s salary payment will be suspended today. It comes from payroll-review@outlook.com and links to a non-company sign-in page asking for a password and verification code.",
    question: "How should this email be classified?",
    options: ["Legitimate", "Spam", "Phishing"],
  },
];

export const DEFAULT_DECISION = {
  state: PRESETS[0].state,
  question: PRESETS[0].question,
  options: [...PRESETS[0].options],
};
