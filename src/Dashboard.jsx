// src/Dashboard.jsx
import { useState, useMemo } from "react";
import "./Dashboard.css";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";

/* ===================== HELPERS CHUNG ===================== */

// Lấy danh sách header
const getHeaders = (rows) =>
  rows && rows.length > 0 ? Object.keys(rows[0]) : [];

// Tìm cột theo pattern
const findColumnByPatterns = (headers, patterns) => {
  const lower = headers.map((h) => h.toLowerCase());
  for (const p of patterns) {
    const idx = lower.findIndex((h) => h.includes(p));
    if (idx !== -1) return headers[idx];
  }
  return null;
};

// Lấy số từ 1 cột, nếu k có trả 0
const getNumberFromCol = (row, colName) => {
  if (!colName) return 0;
  const raw = row[colName];
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : n;
};

// Xác định giá trị đúng hạn
const isOnTimeValue = (v) => {
  if (v === undefined || v === null) return false;
  if (v === 1 || v === true) return true;
  const s = String(v).toLowerCase().trim();
  return ["1", "y", "yes", "true", "đúng", "on time", "ontime"].includes(s);
};

// parse "2024-01-01 08:00:00" -> ms
const parseDateTime = (str) => {
  if (!str) return NaN;
  const iso = String(str).replace(" ", "T");
  return Date.parse(iso);
};

/* ===================== KPI FACT_ORDERS ===================== */

function computeOrderKPIs(fact_orders) {
  const totalOrders = fact_orders.length;
  const headers = getHeaders(fact_orders);

  const revenueCol =
    findColumnByPatterns(headers, [
      "revenue",
      "doanhthu",
      "sales",
      "amount",
      "total",
    ]) || null;

  const slaCol =
    findColumnByPatterns(headers, [
      "sla",
      "on_time",
      "ontime",
      "ontimeflag",
      "dunghan",
    ]) || null;

  const feedbackCol =
    findColumnByPatterns(headers, [
      "feedback",
      "rating",
      "score",
      "điểm",
    ]) || null;

  const totalRevenue = fact_orders.reduce(
    (sum, row) => sum + getNumberFromCol(row, revenueCol),
    0
  );

  const onTimeCount = fact_orders.filter((row) =>
    isOnTimeValue(slaCol ? row[slaCol] : undefined)
  ).length;
  const onTimeRate = totalOrders ? (onTimeCount / totalOrders) * 100 : 0;

  const fbArr = fact_orders
    .map((row) => getNumberFromCol(row, feedbackCol))
    .filter((v) => v > 0);
  const avgFeedback =
    fbArr.length > 0 ? fbArr.reduce((a, b) => a + b, 0) / fbArr.length : 0;

  return {
    totalOrders,
    totalRevenue,
    onTimeRate,
    avgFeedback,
  };
}

/* ===================== KPI FACT_FLOW ===================== */

function computeFlowKPIs(fact_flow) {
  if (!fact_flow || fact_flow.length === 0) return { avgShipDays: 0 };

  const headers = getHeaders(fact_flow);

  const orderIdCol =
    headers.includes("OrderID")
      ? "OrderID"
      : findColumnByPatterns(headers, ["orderid", "order_id", "order"]);

  const stageStartCol =
    headers.includes("StageStart")
      ? "StageStart"
      : findColumnByPatterns(headers, ["stagestart", "start"]);

  const stageEndCol =
    headers.includes("StageEnd")
      ? "StageEnd"
      : findColumnByPatterns(headers, ["stageend", "end"]);

  if (!orderIdCol || !stageStartCol || !stageEndCol) {
    console.warn("Không tìm thấy OrderID / StageStart / StageEnd trong fact_flow");
    return { avgShipDays: 0 };
  }

  const orderMap = new Map();
  fact_flow.forEach((row) => {
    const id = row[orderIdCol];
    if (!id) return;

    const startMs = parseDateTime(row[stageStartCol]);
    const endMs = parseDateTime(row[stageEndCol]);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;

    const cur = orderMap.get(id) || {
      minStart: startMs,
      maxEnd: endMs,
    };

    cur.minStart = Math.min(cur.minStart, startMs);
    cur.maxEnd = Math.max(cur.maxEnd, endMs);

    orderMap.set(id, cur);
  });

  const daysList = [];
  for (const { minStart, maxEnd } of orderMap.values()) {
    const diffMs = maxEnd - minStart;
    const diffMinutes = diffMs / (1000 * 60);
    const days = diffMinutes / 1440;
    if (days > 0) daysList.push(days);
  }

  const avgShipDays =
    daysList.length > 0
      ? daysList.reduce((a, b) => a + b, 0) / daysList.length
      : 0;

  return { avgShipDays };
}

/* ===================== FORMAT HIỂN THỊ ===================== */

const fmtNumber = (n) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + "M"
    : n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const fmtPercent = (n) => `${n.toFixed(2)}%`;
const fmtFloat = (n) => n.toFixed(2);

/* ===================== UI PHẦN FILTER ===================== */

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="filter-item">
      <div className="filter-label">{label}</div>

      <div className="filter-select-wrapper">
        <select
          className="filter-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="ALL">Tất cả</option>
          {options.map((opt) => {
            const val =
              typeof opt === "object" && opt !== null ? opt.value : opt;
            const lab =
              typeof opt === "object" && opt !== null ? opt.label : opt;

            return (
              <option key={val} value={val}>
                {String(lab)}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

/* ===================== UI CARD KPI ===================== */

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="metric-card">
      <div className="metric-card-top-glow" />
      <div className="metric-card-inner">
        <div className="metric-card-title">{title}</div>
        <div className="metric-card-value">{value}</div>
        <div className="metric-card-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

/* =========== BIỂU ĐỒ TỔNG ĐƠN & DOANH THU THEO THÁNG =========== */

function MonthlyOrdersRevenueChart({ data }) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 40, bottom: 50, left: 10 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />

        <XAxis
          dataKey="month"
          tick={{ fill: "#9CA3AF" }}
          label={{
            value: "Month",
            position: "insideBottom",
            offset: -20,
            fill: "#9CA3AF",
          }}
        />

        <YAxis
          yAxisId="left"
          tick={{ fill: "#9CA3AF" }}
          label={{
            value: "Tổng đơn",
            angle: -90,
            position: "insideLeft",
            offset: 10,
            fill: "#9CA3AF",
          }}
        />

        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "#9CA3AF" }}
          label={{
            value: "Tổng doanh thu",
            angle: 90,
            position: "insideRight",
            dx: 40,
            fill: "#9CA3AF",
          }}
        />

        <Tooltip
          formatter={(val, name) => {
            const lower = String(name).toLowerCase();
            if (lower.includes("doanh")) {
              return (
                val.toLocaleString("vi-VN", {
                  maximumFractionDigits: 0,
                }) + " ₫"
              );
            }
            return val;
          }}
        />

        <Legend
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ paddingTop: 30 }}
        />

        <Bar
          yAxisId="left"
          dataKey="orderCount"
          name="Tổng đơn"
          fill="#3B82F6"
          radius={[10, 10, 0, 0]}
          barSize={28}
        />

        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          name="Tổng doanh thu"
          stroke="#60A5FA"
          strokeWidth={3}
          strokeDasharray="4 4"
          dot={{ r: 4, fill: "#93C5FD" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* =========== BIỂU ĐỒ BUBBLE: TỔNG ĐƠN DOANH THU THEO KÊNH =========== */

const CHANNEL_COLORS = {
  Facebook: "#3B82F6",
  Lazada: "#1D4ED8",
  Shopee: "#F97316",
  Tiktok: "#6B21A8",
  Website: "#EC4899",
};

function BubbleChannelChart({ data }) {
  if (!data || data.length === 0) return null;

  // mỗi điểm = 1 kênh
  const scatterData = data.map((d) => ({
    channelName: d.channelName,
    revenue: d.revenue,
    orders: d.orders,
    size: d.size,
  }));

  // Tooltip: luôn đúng 1 điểm được hover
  const renderChannelTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const p = payload[0].payload;

    return (
      <div
        style={{
          background: "#111827",
          border: "1px solid #4B5563",
          borderRadius: 8,
          padding: "8px 12px",
          color: "#F9FAFB",
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {p.channelName}
        </div>
        <div>Doanh thu: {p.revenue.toLocaleString("vi-VN")} ₫</div>
        <div>Số đơn: {p.orders}</div>
      </div>
    );
  };

  // Legend custom: giống kiểu chấm + text
  const renderLegend = () => {
    const order = ["Facebook", "Lazada", "Shopee", "Tiktok", "Website"];
    const present = order.filter((ch) =>
      scatterData.some((d) => d.channelName === ch)
    );

    return (
      <div className="bubble-legend">
        {present.map((ch) => (
          <div key={ch} className="bubble-legend-item">
            <span
              className="bubble-legend-dot"
              style={{ backgroundColor: CHANNEL_COLORS[ch] }}
            />
            <span>{ch}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={450}>
      <ScatterChart margin={{ top: 20, right: 40, bottom: 80, left: 20 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />

<XAxis
  type="number"
  dataKey="revenue"
  name="Doanh thu"
  domain={[
    (dataMin) => Math.floor(dataMin / 5_000_000) * 5_000_000 - 2_000_000,
    (dataMax) => Math.ceil(dataMax / 5_000_000) * 5_000_000 + 2_000_000,
  ]}
  tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "M"}
  label={{
    value: "Sum of Doanh thu",
    position: "insideBottom",
    offset: -24,
    fill: "#9CA3AF",
  }}
  tick={{ fill: "#9CA3AF" }}
/>
<YAxis
  type="number"
  dataKey="orders"
  name="Tổng đơn"
  domain={[
    (dataMin) => Math.floor(dataMin / 5) * 5 - 5,
    (dataMax) => Math.ceil(dataMax / 5) * 5 + 5,
  ]}
  tick={{ fill: "#9CA3AF" }}
  tickFormatter={(v) => v} 
  label={{
    value: "Count of OrderID",
    angle: -90,
    position: "insideLeft",
    fill: "#9CA3AF",
  }}
/>


        {/* vòng tròn to hơn */}
        <ZAxis type="number" dataKey="size" range={[260, 820]} name="Số đơn" />

        <Tooltip content={renderChannelTooltip} />

        {/* legend dưới, không đè label trục X */}
        <Legend
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ paddingTop: 24, marginTop: 4 }}
          content={renderLegend}
        />

        {/* 1 scatter, tô màu từng điểm bằng Cell */}
        <Scatter data={scatterData} shape="circle">
          {scatterData.map((entry, idx) => (
            <Cell
              key={`cell-${idx}`}
              fill={CHANNEL_COLORS[entry.channelName] || "#3B82F6"}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ===================== DASHBOARD ===================== */

export default function Dashboard({ data }) {
  const { fact_orders, fact_flow, dim_channel } = data;

  const [selectedDate, setSelectedDate] = useState("ALL");
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
  const [selectedChannel, setSelectedChannel] = useState("ALL");

  const orderHeaders = getHeaders(fact_orders);
  const flowHeaders = getHeaders(fact_flow);

  const orderIdColOrders =
    orderHeaders.includes("OrderID")
      ? "OrderID"
      : findColumnByPatterns(orderHeaders, ["orderid", "order_id", "order"]);

  const orderIdColFlow =
    flowHeaders.includes("OrderID")
      ? "OrderID"
      : findColumnByPatterns(flowHeaders, ["orderid", "order_id", "order"]);

  const dateCol =
    findColumnByPatterns(orderHeaders, ["date", "ngay"]) || null;

  const channelCol =
    findColumnByPatterns(orderHeaders, ["channel", "kenh"]) || null;

  const warehouseColFlow =
    flowHeaders.includes("Location")
      ? "Location"
      : findColumnByPatterns(flowHeaders, [
          "warehouse",
          "location",
          "wh_",
          "kho",
        ]);

  const revenueCol =
    findColumnByPatterns(orderHeaders, [
      "revenue",
      "doanhthu",
      "sales",
      "amount",
      "total",
    ]) || null;

  /* ======= OPTIONS DROPDOWN ======= */

  const dateOptions = useMemo(() => {
    if (!dateCol) return [];
    const set = new Set(
      fact_orders
        .map((r) => r[dateCol])
        .filter((v) => v !== undefined && v !== null && v !== "")
    );
    return Array.from(set).sort();
  }, [fact_orders, dateCol]);

  const warehouseOptions = useMemo(() => {
    if (!warehouseColFlow) return [];
    const set = new Set(
      fact_flow
        .map((r) => r[warehouseColFlow])
        .filter((v) => v !== undefined && v !== null && v !== "")
    );
    return Array.from(set).sort();
  }, [fact_flow, warehouseColFlow]);

  const channelOptions = useMemo(() => {
    if (!dim_channel) return [];

    const options = dim_channel
      .filter((r) => r.ChannelID && r.ChannelName)
      .map((r) => ({
        value: r.ChannelID,
        label: r.ChannelName,
      }));

    options.sort((a, b) => a.label.localeCompare(b.label, "vi"));
    return options;
  }, [dim_channel]);

  /* ======= ÁP DỤNG FILTER ======= */

  const { filteredOrders, filteredFlow } = useMemo(() => {
    let orders = [...fact_orders];
    let flow = [...fact_flow];

    if (dateCol && selectedDate !== "ALL") {
      orders = orders.filter((r) => r[dateCol] === selectedDate);
    }
    if (channelCol && selectedChannel !== "ALL") {
      orders = orders.filter((r) => r[channelCol] === selectedChannel);
    }

    if (warehouseColFlow && selectedWarehouse !== "ALL") {
      flow = flow.filter((r) => r[warehouseColFlow] === selectedWarehouse);
    }

    if (orderIdColOrders && orderIdColFlow) {
      const allowedOrderIdsFromOrders = new Set(
        orders.map((r) => r[orderIdColOrders])
      );
      flow = flow.filter((r) =>
        allowedOrderIdsFromOrders.has(r[orderIdColFlow])
      );

      const allowedOrderIdsFromFlow = new Set(
        flow.map((r) => r[orderIdColFlow])
      );
      orders = orders.filter((r) =>
        allowedOrderIdsFromFlow.size > 0
          ? allowedOrderIdsFromFlow.has(r[orderIdColOrders])
          : true
      );
    }

    return { filteredOrders: orders, filteredFlow: flow };
  }, [
    fact_orders,
    fact_flow,
    dateCol,
    channelCol,
    warehouseColFlow,
    selectedDate,
    selectedChannel,
    selectedWarehouse,
    orderIdColOrders,
    orderIdColFlow,
  ]);

  /* ======= TÍNH KPI ======= */

  const orderKpis = computeOrderKPIs(filteredOrders);
  const flowKpis = computeFlowKPIs(filteredFlow);

  /* ======= DATA CHO BIỂU ĐỒ THÁNG ======= */

  const monthlyChartData = useMemo(() => {
    if (!dateCol || !revenueCol || !filteredOrders.length) return [];

    const map = new Map();

    filteredOrders.forEach((row) => {
      const rawDate = row[dateCol];
      if (!rawDate) return;

      const d = new Date(String(rawDate));
      if (Number.isNaN(d.getTime())) return;

      const month = d.getMonth() + 1;
      const key = month;

      const revenue = getNumberFromCol(row, revenueCol);

      const cur =
        map.get(key) || { month, orderCount: 0, revenue: 0 };

      cur.orderCount += 1;
      cur.revenue += revenue;

      map.set(key, cur);
    });

    return Array.from(map.values()).sort((a, b) => a.month - b.month);
  }, [filteredOrders, dateCol, revenueCol]);

  /* ======= DATA CHO BUBBLE CHART THEO KÊNH ======= */

  const channelBubbleData = useMemo(() => {
    if (!channelCol || !revenueCol || !orderIdColOrders) return [];

    const map = new Map();

    filteredOrders.forEach((row) => {
      const channelId = row[channelCol];
      if (!channelId) return;

      const revenue = getNumberFromCol(row, revenueCol);
      const orderId = row[orderIdColOrders];

      // Ưu tiên tên kênh text (Shopee, Lazada...) nếu có
      let channelName =
        typeof channelId === "string" && !channelId.startsWith("CH")
          ? channelId
          : channelId;

      // Nếu chỉ có mã CHxx thì map sang dim_channel
      if (
        dim_channel &&
        Array.isArray(dim_channel) &&
        channelName === channelId
      ) {
        const found = dim_channel.find((c) => c.ChannelID === channelId);
        if (found?.ChannelName) channelName = found.ChannelName;
      }

      let group = map.get(channelName);
      if (!group) {
        group = {
          channelName,
          revenue: 0,
          ordersSet: new Set(),
        };
      }

      group.revenue += revenue;
      if (orderId !== undefined && orderId !== null) {
        group.ordersSet.add(orderId);
      }

      map.set(channelName, group);
    });

    return Array.from(map.values()).map((g) => ({
      channelName: g.channelName,
      revenue: g.revenue,
      orders: g.ordersSet.size,
      size: g.ordersSet.size,
    }));
  }, [filteredOrders, channelCol, revenueCol, orderIdColOrders, dim_channel]);

  const metrics = [
    {
      title: "TỔNG ĐƠN HÀNG",
      value: fmtNumber(orderKpis.totalOrders),
      subtitle: "Trong bộ lọc hiện tại",
    },
    {
      title: "TỔNG DOANH THU",
      value: fmtNumber(orderKpis.totalRevenue),
      subtitle: "VNĐ",
    },
    {
      title: "TỶ LỆ ĐÚNG HẠN",
      value: fmtPercent(orderKpis.onTimeRate),
      subtitle: "Tính theo SLA / On-time",
    },
    {
      title: "ĐIỂM FEEDBACK TRUNG BÌNH",
      value: fmtFloat(orderKpis.avgFeedback),
      subtitle: "Thang điểm 5 (nếu có)",
    },
    {
      title: "THỜI GIAN VẬN CHUYỂN TB",
      value: fmtFloat(flowKpis.avgShipDays),
      subtitle: "Ngày (logic LeadTime_Days_Exact)",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-title">BÁO CÁO TỔNG QUAN</div>

      <div className="dashboard-filters">
        <FilterSelect
          label="NGÀY"
          value={selectedDate}
          onChange={setSelectedDate}
          options={dateOptions}
        />
        <FilterSelect
          label="KHO"
          value={selectedWarehouse}
          onChange={setSelectedWarehouse}
          options={warehouseOptions}
        />
        <FilterSelect
          label="KÊNH"
          value={selectedChannel}
          onChange={setSelectedChannel}
          options={channelOptions}
        />
      </div>

      <div className="dashboard-row">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} />
        ))}
      </div>

      {/* Box: chart tháng */}
      <div className="chart-card">
        <div className="chart-header">
          <div className="insight-title">
            1. Phân tích xu hướng đơn hàng và doanh thu
          </div>
          <p className="insight-text">
            Từ biểu đồ{" "}
            <span className="pill pill-blue">
              “Tổng đơn và doanh thu theo tháng”
            </span>
            , chúng ta có thể xác định những tháng có
            <span className="pill pill-red"> doanh thu thấp </span>
            và kiểm tra xem xu hướng này có kéo dài trong
            <span className="pill pill-gold"> nhiều tháng liên tiếp </span>
            hay không.
          </p>
        </div>

        <h3 className="chart-title">Tổng đơn và doanh thu theo tháng</h3>

        <div className="dashboard-row chart-row">
          <MonthlyOrdersRevenueChart data={monthlyChartData} />
        </div>
      </div>

      {/* Box: bubble chart theo kênh */}
      <div className="chart-card">
        <div className="chart-header">
          <div className="insight-title">
            2. Hiệu suất doanh thu theo kênh bán hàng
          </div>
          <p className="insight-text">
            Biểu đồ bubble thể hiện{" "}
            <span className="pill pill-blue">tổng doanh thu</span> (trục
            ngang),{" "}
            <span className="pill pill-blue">tổng đơn hàng</span> (trục
            dọc) và <span className="pill pill-gold">kích thước bubble</span>{" "}
            tương ứng với số đơn, giúp so sánh nhanh hiệu quả giữa các
            kênh.
          </p>
        </div>

        <h3 className="chart-title">Tổng đơn doanh thu theo kênh</h3>

        <div className="dashboard-row chart-row">
          <BubbleChannelChart data={channelBubbleData} />
        </div>
      </div>
    </div>
  );
}
