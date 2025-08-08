SELECT
  id,
  name,
  email,
  age
FROM
  users
WHERE
  age > 25
AND
  name = '张三'
ORDER BY
  ageDESC