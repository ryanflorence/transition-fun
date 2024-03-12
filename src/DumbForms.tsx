import { useAction } from "./remix";

function doSomething<T extends string>(ms: number, name: T): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log("resolving", name);
      resolve(name);
    }, ms);
  });
}

async function someAction(formData: FormData) {
  return doSomething(2000, String(formData.get("value")));
}

function SomeForm() {
  const [action, isPending, result] = useAction(someAction);

  return (
    <form
      action={action}
      onSubmit={async e => {
        const i = e.currentTarget.value as unknown as HTMLInputElement;
        i.select();
      }}
    >
      <label>
        <input type="text" name="value" defaultValue="beef" />
        <button type="submit">Submit</button>
      </label>
      {isPending ? (
        <p>Loading... {String(isPending.get("value"))}</p>
      ) : result ? (
        <p>{result}</p>
      ) : (
        <p>Waiting on you...</p>
      )}
    </form>
  );
}

function App() {
  return (
    <>
      <SomeForm />
      <hr />
      <SomeForm />
    </>
  );
}

export default App;
