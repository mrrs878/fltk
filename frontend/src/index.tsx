/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-28 19:45:52
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-29 11:55:18
 */

import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";

const App = (props) => {
    const increment = () => {
        props.setState("count", props.state.count + 1);
    };

    const updateText = (e) => {
        props.setText(e.target.value);
    };

    return (
        <div>
            <h1>{props.text}</h1>
            <input type="text" value={props.text} onInput={updateText} />
            <p>Count: {props.state.count}</p>
            <button onClick={increment}>Increment</button>
        </div>
    );
};

render(() => {
    const [state, setState] = createStore({ count: 0 });
    const [text, setText] = createSignal("Hello, Solid.js!");

    return (
        <App
            state={state}
            setState={setState}
            text={text()}
            setText={setText}
        />
    );
}, document.getElementById("app")!);
