export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(200).json({
      success: true,
      message: '佳音启程'
    });
  }

  const route = req.body;

  return res.status(200).json({
    success: true,
    route
  });

}
