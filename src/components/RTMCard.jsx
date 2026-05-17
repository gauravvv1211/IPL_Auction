function RTMCard({ used = false }) {
  return (
    <article className={`rtm-card ${used ? "used" : ""}`} title="Use in auction to match a winning bid and steal a player back from a rival team">
      <strong>RTM</strong>
      <span>Right to Match Card</span>
      <small>{used ? "Used" : "Available"}</small>
    </article>
  );
}

export default RTMCard;
