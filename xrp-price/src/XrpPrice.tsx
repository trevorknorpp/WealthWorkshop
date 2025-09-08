import React, { useEffect, useState } from "react";
import axios from "axios";

const XrpPrice: React.FC = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price",
          {
            params: {
              ids: "ripple", // XRP on CoinGecko
              vs_currencies: "usd",
            },
          }
        );
        setPrice(response.data.ripple.usd);
      } catch (error) {
        console.error("Error fetching XRP price:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();

    // refresh every 30s
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ fontFamily: "Arial", textAlign: "center", marginTop: "40px" }}>
      <h1>XRP Price</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <p style={{ fontSize: "24px", fontWeight: "bold" }}>
          ${price?.toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default XrpPrice;
