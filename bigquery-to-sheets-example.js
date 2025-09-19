// BigQuery → スプレッドシート自動出力例

async function exportToUserSheet(userId, spreadsheetId) {
  // 1. BigQueryからデータ取得
  const query = `
    SELECT
      post_date,
      post_title,
      views,
      likes,
      comments,
      saves,
      follows
    FROM instagram_data
    WHERE user_id = '${userId}'
    ORDER BY post_date DESC
  `;

  const bigqueryData = await runBigQuery(query);

  // 2. あなたの指定フォーマットに変換
  const formattedData = bigqueryData.map(row => [
    row.post_date,           // A列：投稿日
    row.post_title,          // B列：タイトル
    row.views,               // C列：再生数
    row.likes,               // D列：いいね
    row.comments,            // E列：コメント
    row.saves,               // F列：保存数
    row.follows,             // G列：フォロー数
    // 以下、あなたの計算式列
    row.likes / row.views,   // H列：エンゲージメント率
    // などなど...
  ]);

  // 3. スプレッドシートに書き込み
  await updateGoogleSheet(spreadsheetId, formattedData);
}

// 毎日自動実行
function scheduleDaily() {
  // 全ユーザーのスプレッドシートを更新
  const users = getAllUsers();
  users.forEach(user => {
    exportToUserSheet(user.id, user.spreadsheetId);
  });
}