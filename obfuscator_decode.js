const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;
   
const fs = require('fs');
   
function replace_ugly_code(path) {
    let arr_path = path.get('body.0');
    let code = arr_path.toString();
  
    let shift_path = path.get('body.1');
    let callee_path = shift_path.get('expression.callee');
    let second_arg_node = callee_path.get('params.1').node;
       
    let first_body = callee_path.get('body.body.0');
    let call_fun = first_body.node.declarations[0].id
       
    var all_next_siblings = first_body.getAllNextSiblings();
    all_next_siblings.forEach(next_sibling => {
        next_sibling.remove();
    });
       
    first_body.insertBefore(t.ExpressionStatement(t.UpdateExpression("++", second_arg_node)));
    first_body.insertAfter(t.ExpressionStatement(t.callExpression(call_fun, [second_arg_node])));
       
    code += '!' + shift_path.toString();
      
    let call_path = path.get('body.2');
    let call_name = call_path.node.declarations[0].id.name;
    call_path.traverse({
        AssignmentExpression(_path) {
            let left = _path.get('left');
            let left_code = left.toString();
              
            let right = _path.get('right');
            let right_code = right.toString();
              
            if (right_code.indexOf(call_name) === -1 ||
                right_code.indexOf(left_code) === -1 ) 
            {
                return;
            }
              
            const if_parent_path = _path.findParent(p => {
                return p.isIfStatement();
            });
            if_parent_path && if_parent_path.replaceWith(_path.node);
        },
    })
      
    code += call_path.toString();
    return {call_name,code};
}
  
const delete_extra = 
{
    StringLiteral:function(_path)
    {
      delete _path.node.extra;
    },
}
  
  
function replace_simple_code(path) {
      
    traverse(path.node,delete_extra)//防止所有字符串以十六进制形式展现导致查找失败。
        
    let source_code = path.toString();
    if(source_code.indexOf('removeCookie') !== -1) 
    {
        var {call_name,code} = replace_ugly_code(path);
    } 
    else
    {
        let arr_path = path.get('body.0');
        var code = arr_path.toString();
           
        let shift_path = path.get('body.1');
        code += '!' + shift_path.toString();
           
        let call_path = path.get('body.2');
        var call_name = call_path.get('declarations.0.id').toString();
        code += call_path.toString();
    }
       
    eval(code);
    let can_be_delete = true;
       
    path.traverse({
        CallExpression: function(_path) {
            let callee = _path.get('callee');
            if(callee.toString() !== call_name)
                return;
            try
            {
                let value = eval(_path.toString());
                value && _path.replaceWith(t.valueToNode(value))
            }
            catch(e)
            {
                can_be_delete = false;
            }
        },
    });
      
    for (let i=0 ;can_be_delete && i<3; i++)
    {
        path.get('body.0').remove();
    }   
}
   
var jscode = fs.readFileSync("./encode_code.js", {
    encoding: "utf-8"
});
   
const visitor = {
    "Program"(path)
    {
        replace_simple_code(path)
    },
      
};
  
let ast = parser.parse(jscode);
  
traverse(ast, visitor);
  
let {code} = generator(ast);
  
fs.writeFile('decode_code.js', code, (err) => {});
