/**
 * 已知场景硬编码 A2UI 组件构造器
 * 绕过次级 LLM，直接根据 scenario 和业务数据生成组件，毫秒级响应
 */

export type Scenario =
  | "menu"
  | "dish_detail"
  | "orders"
  | "order_detail"
  | "place_order";

export interface BuildA2UIInput {
  scenario: Scenario;
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
}

function parseOutput(output: unknown): any {
  if (typeof output === "string") {
    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  }
  return output;
}

/** 查找指定 toolName 的业务数据 */
function findToolData(
  toolResults: BuildA2UIInput["toolResults"],
  toolName: string,
): any {
  const tr = toolResults.find((t) => t.toolName === toolName);
  if (!tr) return null;
  const parsed = parseOutput(tr.output);
  return parsed?.data ?? parsed;
}

const CATALOG_ID = "https://a2ui.org/specification/v0_9/basic_catalog.json";

/** 场景一：菜单 → Carousel */
function buildMenu(data: any[]): any {
  const dishes = Array.isArray(data) ? data : [];
  return {
    surfaceId: "menu",
    catalogId: CATALOG_ID,
    components: [
      {
        id: "root",
        component: "Column",
        children: ["menu-title", "menu-carousel"],
        align: "center",
      },
      {
        id: "menu-title",
        component: "Text",
        text: "精选菜单",
        variant: "h2",
      },
      {
        id: "menu-carousel",
        component: "Carousel",
        items: dishes.map((d: any) => ({
          id: String(d.id || ""),
          imageUrl: String(d.image || ""),
          title: String(d.name || ""),
          description: `¥${d.price || "0"} | ${d.description || ""}`,
        })),
        action: { event: { name: "view_dish_detail" } },
      },
    ],
    data: { dishes },
  };
}

/** 场景二：菜品详情 → DishDetail */
function buildDishDetail(data: any): any {
  const dish = data || {};
  return {
    surfaceId: "dish-detail",
    catalogId: CATALOG_ID,
    components: [
      {
        id: "root",
        component: "Column",
        children: ["dish-detail"],
        align: "center",
      },
      {
        id: "dish-detail",
        component: "DishDetail",
        dish: { path: "/dish" },
      },
    ],
    data: { dish },
  };
}

/** 场景三：订单列表 → OrderCard 列表 */
function buildOrders(data: any[]): any {
  const orders = Array.isArray(data) ? data : [];
  const orderCards = orders.map((_: any, i: number) => ({
    id: `order-${i}`,
    component: "OrderCard",
    order: { path: `/orders/${i}` },
  }));
  return {
    surfaceId: "orders",
    catalogId: CATALOG_ID,
    components: [
      {
        id: "root",
        component: "Column",
        children: ["order-title", "order-list"],
        align: "center",
      },
      {
        id: "order-title",
        component: "Text",
        text: "我的订单",
        variant: "h3",
      },
      {
        id: "order-list",
        component: "Column",
        children: orderCards.map((c: any) => c.id),
      },
      ...orderCards,
    ],
    data: { orders },
  };
}

/** 场景四：订单详情 → OrderDetail */
function buildOrderDetail(data: any): any {
  const order = data || {};
  return {
    surfaceId: "order-detail",
    catalogId: CATALOG_ID,
    components: [
      {
        id: "root",
        component: "Column",
        children: ["order-detail"],
        align: "center",
      },
      {
        id: "order-detail",
        component: "OrderDetail",
        order: { path: "/order" },
      },
    ],
    data: { order },
  };
}

/** 场景五：下单成功 → Text + OrderCard */
function buildPlaceOrder(data: any): any {
  const order = data || {};
  return {
    surfaceId: "place-order",
    catalogId: CATALOG_ID,
    components: [
      {
        id: "root",
        component: "Column",
        children: ["success-text", "new-order"],
        align: "center",
      },
      {
        id: "success-text",
        component: "Text",
        text: "下单成功！",
        variant: "h3",
      },
      {
        id: "new-order",
        component: "OrderCard",
        order: { path: "/order" },
      },
    ],
    data: { order },
  };
}

/**
 * 根据 scenario 和业务数据直接构造 A2UI 组件
 * 已知场景毫秒级响应，无需 LLM 参与
 */
export function buildA2UIComponents(input: BuildA2UIInput): {
  surfaceId: string;
  catalogId: string;
  components: any[];
  data?: any;
} {
  const { scenario, toolResults } = input;
  console.log(`[build-a2ui] 硬编码构造组件，scenario: ${scenario}`);

  switch (scenario) {
    case "menu": {
      const data = findToolData(toolResults, "query_menu");
      return buildMenu(data);
    }
    case "dish_detail": {
      const data = findToolData(toolResults, "get_dish_detail");
      return buildDishDetail(data);
    }
    case "orders": {
      const data = findToolData(toolResults, "get_orders");
      return buildOrders(data);
    }
    case "order_detail": {
      const data = findToolData(toolResults, "get_order_detail");
      return buildOrderDetail(data);
    }
    case "place_order": {
      const data = findToolData(toolResults, "place_order");
      return buildPlaceOrder(data);
    }
    default:
      throw new Error(`[build-a2ui] 未知 scenario: ${scenario}`);
  }
}
