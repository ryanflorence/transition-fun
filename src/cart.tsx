import "./cart.css";
import * as React from "react";
import { useAction, useTarget } from "./remix";

export default function App() {
  return (
    <>
      <h1>Cart</h1>
      <main>
        <React.Suspense fallback={<p>Loading Products...</p>}>
          <Products />
        </React.Suspense>
        <React.Suspense fallback={<p>Loading Cart...</p>}>
          <Cart />
        </React.Suspense>
      </main>
    </>
  );
}

type Product = {
  id: string;
  name: string;
  price: number;
};

const cart = (() => {
  const items = new Set<Product>([{ id: "1", name: "Shoes", price: 20 }]);
  const emitter = new EventTarget();
  const add = async (item: Product) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    items.add(item);
    emitter.dispatchEvent(new CustomEvent("change"));
  };
  const remove = (item: Product) => {
    items.delete(item);
    emitter.dispatchEvent(new CustomEvent("change"));
  };
  const get = () => {
    return new Promise<Product[]>(resolve => {
      setTimeout(() => {
        resolve(Array.from(items));
      }, 500);
    });
  };
  return { items, add, remove, emitter, get };
})();

function Cart() {
  const items = useTarget(() => cart.get(), "cart");
  // const items = [];
  return (
    <aside>
      {items.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              {item.name} - {item.price}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

const fetchProducts = () => {
  return new Promise<Product[]>(resolve => {
    setTimeout(() => {
      resolve([
        { id: "1", name: "Shoes", price: 20 },
        { id: "2", name: "Hat", price: 40 },
        { id: "3", name: "Socks", price: 5 },
        { id: "4", name: "Pants", price: 60 },
        { id: "5", name: "Shirt", price: 30 },
        { id: "6", name: "Jacket", price: 80 },
        { id: "7", name: "Gloves", price: 10 },
        { id: "8", name: "Scarf", price: 15 },
        { id: "9", name: "Belt", price: 25 },
        { id: "10", name: "Sunglasses", price: 35 },
        { id: "11", name: "Watch", price: 100 },
      ]);
    }, 500);
  });
};

function Products() {
  const products = useTarget(() => fetchProducts(), "products");
  return (
    <div>
      <h2>Products</h2>
      <div className="product-grid">
        {products.map(product => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

async function addItemToCart(formData: FormData) {
  const id = String(formData.get("id"));
  const name = String(formData.get("name"));
  const price = Number(formData.get("price"));
  await cart.add({ id, name, price });
}

function ProductTile({ product }: { product: Product }) {
  const [add, formData] = useAction(addItemToCart, ["cart"]);

  return (
    <form key={product.id} action={add}>
      <div>
        <b>{product.name}</b> <span>${product.price}</span>
      </div>
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="name" value={product.name} />
      <input type="hidden" name="price" value={product.price} />
      <button type="submit">{formData ? "Adding..." : "Add to cart"}</button>
    </form>
  );
}
