export const formatCr = (value) => `Rs ${Number(value ?? 0).toFixed(2)} Cr`;

export const flagForNationality = (nationality) => (nationality === "Indian" ? "IN" : "OS");

export const tierClass = (tier) => {
  switch (tier) {
    case "Icon":
      return "tier-icon";
    case "Star":
      return "tier-star";
    case "Solid":
      return "tier-solid";
    default:
      return "tier-budget";
  }
};

export const roleClass = (role) => {
  switch (role) {
    case "BAT":
      return "role-bat";
    case "BOWL":
      return "role-bowl";
    case "AR":
      return "role-ar";
    default:
      return "role-wk";
  }
};

export const shuffle = (items) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

export const countOverseas = (players) =>
  players.filter((player) => player.nationality === "Overseas").length;

export const getVerdict = (score) => {
  if (score >= 90) return "Dynasty Builder";
  if (score >= 75) return "Title Contender";
  if (score >= 60) return "Playoff Hopeful";
  if (score >= 45) return "Mid-Table Mess";
  return "Sold The Future";
};

export const getGrade = (score) => {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
};
