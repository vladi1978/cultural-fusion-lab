import {describe,it,expect} from "vitest";
import {extractFunctionalContract,functionalAlignmentScore} from "./functional-contract";
describe("P10.23-A functional contract",()=>{
  it("extracts explicit interactive change",()=>{
    const c=extractFunctionalContract("Participants should make choices that change sequence and intensity.");
    expect(c.choiceDependent).toBe(true);
    expect(c.verification).toBe("explicit");
  });
  it("does not invent requirements for a topic",()=>{
    expect(extractFunctionalContract("Nordic and Japanese wellness").verification).toBe("unverified");
  });
  it("ranks described user operations above unrelated mechanisms",()=>{
    const c=extractFunctionalContract("Visitors should choose routes that change duration.");
    const weak=functionalAlignmentScore(c,{mechanics:"A beautiful guided visit.",journey:[]});
    const strong=functionalAlignmentScore(c,{mechanics:"Visitors choose routes, which change duration.",journey:[]});
    expect(strong).toBeGreaterThan(weak);
  });
});
