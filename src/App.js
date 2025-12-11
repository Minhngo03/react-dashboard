import React, { useEffect, useState } from "react";
import { loadCSV } from "./utils/loadData";
import Dashboard from "./Dashboard";

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadDataModel = async () => {
      const dim_channel = await loadCSV("dim_channel.csv");
      const dim_customer = await loadCSV("dim_customer.csv");
      const dim_date = await loadCSV("dim_date_2024.csv");
      const dim_product = await loadCSV("dim_product (1).csv");
      const dim_stage = await loadCSV("dim_stage.csv");
      const dim_warehouse = await loadCSV("dim_warehouse (1).csv");

      const fact_orders = await loadCSV("fact_orders_2024_1000_extreme_month_variation.csv");
      const fact_flow = await loadCSV("fact_warehouseflow_2024_1000_leadtime_5to6days.csv");

      setData({
        dim_channel,
        dim_customer,
        dim_date,
        dim_product,
        dim_stage,
        dim_warehouse,
        fact_orders,
        fact_flow,
      });
    };

    loadDataModel();
  }, []);

  if (!data) return <div style={{ color: "#fff" }}>Đang tải dữ liệu...</div>;

  return <Dashboard data={data} />;
}

export default App;
