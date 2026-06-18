export default async function handler(req, res) {

    // 允许跨域（开发阶段）
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Only POST is allowed"
        });
    }

    const route = req.body;

    console.log("收到线路：", route);

    return res.status(200).json({
        success: true,
        message: "已收到线路，准备写入 GitHub。",
        route
    });

}
